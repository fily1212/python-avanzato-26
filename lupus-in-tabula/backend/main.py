"""
Lupus in Tabula – FastAPI backend.
Auth, game logic, night resolution, history.
"""
from __future__ import annotations

import os
import random
import time
from collections import Counter
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from database import Database
from models import (
    ActionRequest, ActionType, CreateGameRequest, GameState, GuessRequest,
    LoginRequest, RegisterRequest, Role, VoteRequest,
    WOLF_FACTION, EVIL_FACTION, NEUTRAL_FACTION, ROLE_ACTIONS, ROLE_EMOJI,
    NIGHT_DURATION, DAY_DURATION, REVEAL_DURATION,
    PlayerPublic, PlayerSelf, WolfVoteInfo, UserInfo,
    get_role_distribution,
)

db = Database()

# Environment: "production" or "development"
ENV = os.getenv("ENV", "development")
CORS_ORIGINS = (
    ["https://itisgrassi.vps.webdock.cloud"]
    if ENV == "production"
    else ["http://localhost:5173"]
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    db.close()


app = FastAPI(title="Lupus in Tabula", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth helpers ───────────────────────────────────────

def _get_user(request: Request) -> dict:
    sid = request.cookies.get("session")
    if not sid:
        raise HTTPException(401, "Non autenticato")
    sess = db.get_session(sid)
    if not sess:
        raise HTTPException(401, "Sessione scaduta")
    user = db.get_user(sess["user_id"])
    if not user:
        raise HTTPException(401, "Utente non trovato")
    return user


def _now() -> float:
    return time.time()


def _seconds_left(game: dict) -> int:
    return max(0, int(game["phase_end_time"] - _now()))


# ═══════════════════════════════════════════════════════
#  AUTH ENDPOINTS
# ═══════════════════════════════════════════════════════

@app.post("/register")
def register(req: RegisterRequest, response: Response):
    try:
        user = db.create_user(req.username, req.password)
    except ValueError as e:
        raise HTTPException(400, str(e))
    sid = db.create_session(user["id"])
    response.set_cookie("session", sid, httponly=True, samesite="lax")
    return {"ok": True, "username": user["username"]}


@app.post("/login")
def login(req: LoginRequest, response: Response):
    user = db.verify_user(req.username, req.password)
    if not user:
        raise HTTPException(401, "Credenziali errate")
    sid = db.create_session(user["id"])
    response.set_cookie("session", sid, httponly=True, samesite="lax")
    return {"ok": True, "username": user["username"]}


@app.post("/logout")
def logout(request: Request, response: Response):
    sid = request.cookies.get("session")
    if sid:
        db.delete_session(sid)
    response.delete_cookie("session")
    return {"ok": True}


@app.get("/me")
def me(request: Request):
    user = _get_user(request)
    current = db.find_active_game_for_user(user["id"])
    return UserInfo(
        id=user["id"],
        username=user["username"],
        current_game=current,
        stats=user.get("stats", {}),
    )


# ═══════════════════════════════════════════════════════
#  GAME ENDPOINTS
# ═══════════════════════════════════════════════════════

@app.post("/create_game")
def create_game(req: CreateGameRequest, request: Request):
    user = _get_user(request)
    # Check not already in a game
    current = db.find_active_game_for_user(user["id"])
    if current:
        raise HTTPException(400, f"Sei già nella partita {current}")
    game = db.create_game(user["id"], req.target_players)
    db.add_player(game["id"], user["id"], user["username"])
    return {"game_id": game["id"]}


@app.post("/join_game/{game_id}")
def join_game(game_id: str, request: Request):
    user = _get_user(request)
    game = db.get_game(game_id.upper())
    if not game:
        raise HTTPException(404, "Partita non trovata")
    if game["state"] != GameState.LOBBY.value:
        raise HTTPException(400, "La partita è già iniziata")
    current = db.find_active_game_for_user(user["id"])
    if current and current != game["id"]:
        raise HTTPException(400, f"Sei già nella partita {current}")

    players = db.get_game_players(game["id"])
    if len(players) >= game["target_players"]:
        raise HTTPException(400, "Partita piena")
    # Already in this game?
    if any(p["user_id"] == user["id"] for p in players):
        return {"game_id": game["id"], "already_joined": True}
    # Check duplicate nickname
    if any(p["nickname"].lower() == user["username"].lower() for p in players):
        raise HTTPException(400, "Nickname già usato")

    db.add_player(game["id"], user["id"], user["username"])
    players = db.get_game_players(game["id"])

    # Auto-start
    if len(players) >= game["target_players"]:
        _start_game(game["id"])

    return {"game_id": game["id"]}


@app.get("/games")
def list_games():
    lobbies = db.list_open_games()
    result = []
    for g in lobbies:
        ps = db.get_game_players(g["id"])
        result.append({
            "id": g["id"],
            "target_players": g["target_players"],
            "current_players": len(ps),
            "creator": g.get("creator_id", ""),
        })
    return result


# ── Game state polling ─────────────────────────────────

@app.get("/game_state/{game_id}")
def get_game_state(game_id: str, request: Request):
    user = _get_user(request)
    game = db.get_game(game_id.upper())
    if not game:
        raise HTTPException(404, "Partita non trovata")

    player = db.get_player_in_game(game["id"], user["id"])
    
    # Allow non-players to view LOBBY state
    if not player and game["state"] != GameState.LOBBY.value:
        raise HTTPException(403, "Non sei in questa partita")

    # Advance phase if timer expired
    _maybe_advance(game["id"])
    game = db.get_game(game["id"])
    if player:
        player = db.get_player_in_game(game["id"], user["id"])

    all_players = db.get_game_players(game["id"])
    state = game["state"]

    players_public = [
        PlayerPublic(id=p["id"], nickname=p["nickname"], is_alive=p["is_alive"]).model_dump()
        for p in all_players
    ]

    # If not in game (lobby viewer), me is None
    me_data = None
    if player:
        me_data = PlayerSelf(
            id=player["id"], nickname=player["nickname"],
            role=player["role"] or "?",
            is_alive=player["is_alive"],
            attributes=player.get("attributes", {}),
        ).model_dump()

    # Role distribution (counts, not who)
    roles_in_game = game.get("roles_in_game", {})

    resp: dict = {
        "game_id": game["id"],
        "state": state,
        "turn_number": game["turn_number"],
        "timer_seconds_left": _seconds_left(game),
        "target_players": game["target_players"],
        "players": players_public,
        "me": me_data,
        "roles_in_game": roles_in_game,
        "night_deaths": [],
        "day_deaths": [],
        "wolf_votes": None,
        "wolf_teammates": [],
        "night_message": None,
        "day_votes": {},
        "winners": None,
        "winner_detail": None,
        "events": [],
        "all_roles": None,
    }

    my_role = player["role"] if player else None

    # ── LOBBY ──
    if state == GameState.LOBBY.value:
        return resp

    # ── ROLE_REVEAL ──
    if state == GameState.ROLE_REVEAL.value:
        return resp

    # ── NIGHT ──
    if state == GameState.NIGHT.value:
        # Wolf teammates
        if my_role in [r.value for r in WOLF_FACTION]:
            teammates = [
                p["nickname"] for p in all_players
                if p["role"] in [r.value for r in WOLF_FACTION] and p["id"] != player["id"]
            ]
            resp["wolf_teammates"] = teammates

            # Wolf kill votes
            kill_actions = db.get_actions(game["id"], ActionType.KILL.value)
            pid_nick = {p["id"]: p["nickname"] for p in all_players}
            resp["wolf_votes"] = {
                pid_nick.get(a["player_id"], "?"): pid_nick.get(a["target_id"], "?")
                for a in kill_actions
            }

        # Night messages
        resp["night_message"] = _get_night_message(game, player, all_players)

    # ── DAY ──
    if state == GameState.DAY.value:
        resp["night_deaths"] = game.get("night_deaths", [])
        votes = db.get_votes(game["id"])
        pid_nick = {p["id"]: p["nickname"] for p in all_players}
        resp["day_votes"] = {
            pid_nick.get(v["player_id"], "?"): pid_nick.get(v["target_id"], "?")
            for v in votes
        }

    # ── GAME OVER ──
    if state == GameState.GAME_OVER.value:
        resp["winners"] = game.get("winners", "")
        resp["winner_detail"] = game.get("winner_detail", "")
        resp["events"] = game.get("events", [])
        resp["all_roles"] = [
            {"nickname": p["nickname"], "role": p.get("original_role", p["role"]),
             "final_role": p["role"], "is_alive": p["is_alive"]}
            for p in all_players
        ]

        # Build guess leaderboard
        all_guesses = db.get_guesses(game["id"])
        pid_to_player = {p["id"]: p for p in all_players}
        guesser_scores: dict[str, dict] = {}
        for g in all_guesses:
            guesser = pid_to_player.get(g["player_id"])
            target = pid_to_player.get(g["target_id"])
            if not guesser or not target:
                continue
            gid = g["player_id"]
            if gid not in guesser_scores:
                guesser_scores[gid] = {
                    "nickname": guesser["nickname"],
                    "role": guesser.get("original_role", guesser["role"]),
                    "correct": 0, "total": 0,
                }
            guesser_scores[gid]["total"] += 1
            actual_role = target.get("original_role", target["role"])
            if g["guessed_role"] == actual_role:
                guesser_scores[gid]["correct"] += 1

        leaderboard = sorted(guesser_scores.values(), key=lambda x: -x["correct"])
        resp["guess_leaderboard"] = leaderboard

    return resp


# ── Night action ───────────────────────────────────────

@app.post("/action/{game_id}")
def submit_action(game_id: str, req: ActionRequest, request: Request):
    user = _get_user(request)
    game = db.get_game(game_id.upper())
    if not game:
        raise HTTPException(404, "Partita non trovata")
    if game["state"] != GameState.NIGHT.value:
        raise HTTPException(400, "Non è notte")

    player = db.get_player_in_game(game["id"], user["id"])
    if not player:
        raise HTTPException(403, "Non sei in questa partita")
    if not player["is_alive"]:
        raise HTTPException(400, "Sei morto")

    role = player["role"]
    allowed = ROLE_ACTIONS.get(role, [])
    if req.action_type.value not in allowed:
        raise HTTPException(400, f"Azione {req.action_type} non permessa per {role}")

    # Mitomane can only act on night 2
    if req.action_type == ActionType.COPY and game["turn_number"] != 2:
        raise HTTPException(400, "Il Mitomane agisce solo nella notte 2")

    # Kamikaze can explode only once
    if req.action_type == ActionType.EXPLODE:
        if player.get("attributes", {}).get("kamikaze_used"):
            raise HTTPException(400, "Hai già usato l'esplosione")

    # Validate target
    target = db.get_player(req.target_id)
    if not target or target["game_id"] != game["id"]:
        raise HTTPException(400, "Bersaglio non valido")
    if not target["is_alive"]:
        raise HTTPException(400, "Il bersaglio è morto")
    # Protettore can't protect self
    if req.action_type == ActionType.PROTECT and req.target_id == player["id"]:
        raise HTTPException(400, "Non puoi proteggere te stesso")
    # Wolves can't kill themselves
    if req.action_type == ActionType.KILL and req.target_id == player["id"]:
        raise HTTPException(400, "Non puoi bersagliare te stesso")

    # If kamikaze switches to EXPLODE, remove old KILL; if switches to KILL, remove EXPLODE
    if role == Role.KAMIKAZE.value:
        if req.action_type == ActionType.EXPLODE:
            # Remove existing KILL vote
            existing_kill = db.get_player_action(game["id"], player["id"], ActionType.KILL.value)
            if existing_kill:
                db.actions.remove(
                    (db.actions._query_cache.clear() or True) and
                    (Q.game_id == game["id"]) & (Q.player_id == player["id"]) & (Q.action_type == ActionType.KILL.value)
                ) if False else None
                # Simpler approach
                db.actions.remove(
                    (Q.game_id == game["id"]) & (Q.player_id == player["id"]) & (Q.action_type == ActionType.KILL.value)
                )
        elif req.action_type == ActionType.KILL:
            db.actions.remove(
                (Q.game_id == game["id"]) & (Q.player_id == player["id"]) & (Q.action_type == ActionType.EXPLODE.value)
            )

    db.upsert_action(game["id"], player["id"], req.target_id, req.action_type.value)

    # Immediate feedback for inspection roles
    result = None
    if req.action_type == ActionType.INSPECT:
        if target["role"] in [r.value for r in WOLF_FACTION]:
            # Criceto is seen as "Non Lupo"
            if target["role"] == Role.CRICETO.value:
                result = f"{target['nickname']} NON è un Lupo ✅"
            else:
                result = f"{target['nickname']} è un LUPO 🐺"
        else:
            result = f"{target['nickname']} NON è un Lupo ✅"

    if req.action_type == ActionType.INSPECT_ROLE:
        result = f"{target['nickname']} è: {target['role']} {ROLE_EMOJI.get(Role(target['role']), '')}"

    return {"ok": True, "result": result}


# ── Day vote ───────────────────────────────────────────

@app.post("/vote/{game_id}")
def submit_vote(game_id: str, req: VoteRequest, request: Request):
    user = _get_user(request)
    game = db.get_game(game_id.upper())
    if not game:
        raise HTTPException(404)
    if game["state"] != GameState.DAY.value:
        raise HTTPException(400, "Non è giorno")
    player = db.get_player_in_game(game["id"], user["id"])
    if not player or not player["is_alive"]:
        raise HTTPException(400, "Non puoi votare")
    target = db.get_player(req.target_id)
    if not target or target["game_id"] != game["id"] or not target["is_alive"]:
        raise HTTPException(400, "Bersaglio non valido")
    if req.target_id == player["id"]:
        raise HTTPException(400, "Non puoi votare te stesso")

    db.upsert_vote(game["id"], player["id"], req.target_id)
    return {"ok": True}


# ── Guess (mini-game) ─────────────────────────────────

@app.post("/guess/{game_id}")
def submit_guess(game_id: str, req: GuessRequest, request: Request):
    user = _get_user(request)
    game = db.get_game(game_id.upper())
    if not game:
        raise HTTPException(404)
    if game["state"] not in (GameState.NIGHT.value, GameState.DAY.value):
        raise HTTPException(400, "Non puoi indovinare ora")
    player = db.get_player_in_game(game["id"], user["id"])
    if not player or not player["is_alive"]:
        raise HTTPException(400, "Non puoi giocare")
    # Only idle roles can play
    idle_roles = [Role.VILLICO.value, Role.INDEMONIATO.value, Role.MASSONE.value]
    if player["role"] not in idle_roles:
        raise HTTPException(400, "Solo ruoli senza azione notturna possono giocare")
    target = db.get_player(req.target_id)
    if not target or target["game_id"] != game["id"]:
        raise HTTPException(400, "Bersaglio non valido")
    db.upsert_guess(game["id"], player["id"], req.target_id, req.guessed_role)
    return {"ok": True}


# ── History ────────────────────────────────────────────

@app.get("/history")
def get_history(request: Request):
    user = _get_user(request)
    games = db.list_finished_games_for_user(user["id"])
    result = []
    for g in games:
        ps = db.get_game_players(g["id"])
        # Find current user's player
        me = next((p for p in ps if p["user_id"] == user["id"]), None)
        player_role = me.get("original_role", me["role"]) if me else ""
        
        # Determine if player won
        winners = g.get("winners", "")
        player_won = False
        if me:
            wolf_roles = ["Lupo"]
            evil_roles = ["Lupo", "Oracolo", "Kamikaze", "Indemoniato"]
            if winners == "Lupi" and player_role in evil_roles:
                player_won = True
            elif winners == "Villaggio" and player_role not in evil_roles:
                player_won = True
            elif winners == "Criceto":
                player_won = (player_role == "Criceto Mannaro")
        
        result.append({
            "game_id": g["id"],
            "winners": winners,
            "target_players": g["target_players"],
            "created_at": g.get("created_at", 0),
            "turns": g.get("turn_number", 0),
            "player_role": player_role,
            "player_won": player_won,
            "players": [{"nickname": p["nickname"], "role": p.get("original_role", p["role"])} for p in ps],
        })
    return result


@app.get("/history/{game_id}")
def get_game_history(game_id: str, request: Request):
    user = _get_user(request)
    game = db.get_game(game_id.upper())
    if not game:
        raise HTTPException(404)
    players = db.get_game_players(game["id"])
    return {
        "game_id": game["id"],
        "winners": game.get("winners", ""),
        "winner_detail": game.get("winner_detail", ""),
        "turns": game.get("turn_number", 0),
        "events": game.get("events", []),
        "players": [
            {"nickname": p["nickname"], "role": p.get("original_role", p["role"]),
             "final_role": p["role"], "is_alive": p["is_alive"]}
            for p in players
        ],
    }


# ═══════════════════════════════════════════════════════
#  GAME LOGIC
# ═══════════════════════════════════════════════════════

def _start_game(game_id: str):
    players = db.get_game_players(game_id)
    n = len(players)
    roles = get_role_distribution(n)
    random.shuffle(roles)

    role_counts: dict[str, int] = {}
    for r in roles:
        role_counts[r.value] = role_counts.get(r.value, 0) + 1

    for player, role in zip(players, roles):
        db.update_player(player["id"], {
            "role": role.value,
            "original_role": role.value,
            "attributes": {},
        })

    db.update_game(game_id, {
        "state": GameState.ROLE_REVEAL.value,
        "roles_in_game": role_counts,
        "phase_end_time": _now() + REVEAL_DURATION,
    })
    db.add_event(game_id, 0, "SETUP", "game_start",
                 f"Partita iniziata con {n} giocatori")


def _maybe_advance(game_id: str):
    game = db.get_game(game_id)
    if not game:
        return
    state = game["state"]
    if state in (GameState.LOBBY.value, GameState.GAME_OVER.value):
        return
    if _now() < game.get("phase_end_time", 0):
        return

    if state == GameState.ROLE_REVEAL.value:
        _transition_to_night(game_id)
    elif state == GameState.NIGHT.value:
        _resolve_night(game_id)
    elif state == GameState.DAY.value:
        _resolve_day(game_id)


def _transition_to_night(game_id: str):
    game = db.get_game(game_id)
    turn = game.get("turn_number", 0) + 1
    db.clear_actions(game_id)
    db.clear_votes(game_id)
    db.update_game(game_id, {
        "state": GameState.NIGHT.value,
        "turn_number": turn,
        "phase_end_time": _now() + NIGHT_DURATION,
        "night_deaths": [],
    })
    db.add_event(game_id, turn, "NIGHT", "night_start", f"Notte {turn}")


def _transition_to_day(game_id: str, night_deaths: list[str]):
    db.clear_votes(game_id)
    game = db.get_game(game_id)
    db.update_game(game_id, {
        "state": GameState.DAY.value,
        "phase_end_time": _now() + DAY_DURATION,
        "night_deaths": night_deaths,
        "day_deaths": [],
    })
    db.add_event(game_id, game["turn_number"], "DAY", "day_start",
                 f"Giorno {game['turn_number']}")


def _transition_to_game_over(game_id: str, winners: str, detail: str = ""):
    game = db.get_game(game_id)
    db.update_game(game_id, {
        "state": GameState.GAME_OVER.value,
        "winners": winners,
        "winner_detail": detail,
        "phase_end_time": 0,
    })
    db.add_event(game_id, game["turn_number"], "GAME_OVER", "game_end",
                 f"Vincitore: {winners}. {detail}")

    # Update user stats
    players = db.get_game_players(game_id)
    for p in players:
        db.update_user_stats(p["user_id"], "games")
        role_val = p.get("original_role", p["role"])
        player_won = _did_player_win(role_val, p["role"], winners, p["is_alive"])
        if player_won:
            db.update_user_stats(p["user_id"], "wins")
            if winners == "Lupi":
                db.update_user_stats(p["user_id"], "wolf_wins")
            elif winners == "Villaggio":
                db.update_user_stats(p["user_id"], "village_wins")


def _did_player_win(original_role: str, current_role: str, winners: str, is_alive: bool) -> bool:
    if winners == "Criceto Mannaro":
        return current_role == Role.CRICETO.value and is_alive
    if winners == "Lupi":
        # Evil faction wins (Lupo, Kamikaze, Oracolo, Indemoniato)
        if current_role in [r.value for r in EVIL_FACTION]:
            return True
        # Mitomane that became evil
        if original_role == Role.MITOMANE.value and current_role in [r.value for r in EVIL_FACTION]:
            return True
        return False
    if winners == "Villaggio":
        if current_role in [r.value for r in EVIL_FACTION]:
            return False
        if current_role == Role.CRICETO.value:
            return False
        return True
    return False


def _check_win(game_id: str) -> tuple[str, str] | None:
    alive = db.get_game_players(game_id, alive_only=True)
    # Count Lupo, Kamikaze, Oracolo for win condition (not Indemoniato)
    evil_alive = [p for p in alive if p["role"] in [Role.LUPO.value, Role.KAMIKAZE.value, Role.ORACOLO.value]]
    non_evil_alive = [p for p in alive if p["role"] not in [Role.LUPO.value, Role.KAMIKAZE.value, Role.ORACOLO.value]]
    criceto_alive = any(p["role"] == Role.CRICETO.value for p in alive)

    if not evil_alive:
        if criceto_alive:
            return ("Criceto Mannaro", "Il Criceto Mannaro è sopravvissuto e vince da solo!")
        return ("Villaggio", "Tutti i lupi sono stati eliminati!")

    if len(evil_alive) >= len(non_evil_alive):
        if criceto_alive:
            return ("Criceto Mannaro", "Il Criceto Mannaro è sopravvissuto e vince da solo!")
        return ("Lupi", "I lupi hanno preso il controllo del villaggio!")

    return None


# ── Night resolution (action stack) ───────────────────

def _resolve_night(game_id: str):
    game = db.get_game(game_id)
    turn = game["turn_number"]
    all_players = {p["id"]: p for p in db.get_game_players(game_id)}
    deaths: list[str] = []
    death_ids: set[str] = set()

    # ── 1. MITOMANE (night 2 only) ──
    if turn == 2:
        copy_actions = db.get_actions(game_id, ActionType.COPY.value)
        for ca in copy_actions:
            mitomane = all_players.get(ca["player_id"])
            target = all_players.get(ca["target_id"])
            if mitomane and target and mitomane["is_alive"]:
                target_role = target["role"]
                if target_role in [r.value for r in WOLF_FACTION]:
                    db.update_player(mitomane["id"], {"role": Role.LUPO.value})
                    db.add_event(game_id, turn, "NIGHT", "mitomane_copy",
                                 f"{mitomane['nickname']} ha copiato un Lupo e diventa Lupo!")
                elif target_role == Role.VEGGENTE.value:
                    db.update_player(mitomane["id"], {"role": Role.VEGGENTE.value})
                    db.add_event(game_id, turn, "NIGHT", "mitomane_copy",
                                 f"{mitomane['nickname']} ha copiato il Veggente e diventa Veggente!")
                else:
                    db.add_event(game_id, turn, "NIGHT", "mitomane_copy",
                                 f"{mitomane['nickname']} ha copiato un ruolo senza effetto, resta Villico.")
                    db.update_player(mitomane["id"], {"role": Role.VILLICO.value})

    # Refresh players after mitomane
    all_players = {p["id"]: p for p in db.get_game_players(game_id)}

    # ── 2. PROTETTORE ──
    protect_actions = db.get_actions(game_id, ActionType.PROTECT.value)
    protected_ids: set[str] = set()
    protector_map: dict[str, str] = {}  # protected_id -> protector_id
    for pa in protect_actions:
        if all_players.get(pa["player_id"], {}).get("is_alive"):
            protected_ids.add(pa["target_id"])
            protector_map[pa["target_id"]] = pa["player_id"]
            target_p = all_players.get(pa["target_id"])
            if target_p:
                db.add_event(game_id, turn, "NIGHT", "protect",
                             f"Il Protettore protegge {target_p['nickname']}")

    # ── 3. LUPI (wolf kill vote) ──
    kill_actions = db.get_actions(game_id, ActionType.KILL.value)
    if kill_actions:
        target_counts = Counter(a["target_id"] for a in kill_actions)
        max_votes = max(target_counts.values())
        top_targets = [tid for tid, c in target_counts.items() if c == max_votes]

        # Determine how many kills (1 normally, 2 if >=19 players)
        total_players = len(all_players)
        num_kills = 2 if total_players >= 19 else 1
        targets_to_kill = top_targets[:num_kills] if len(top_targets) <= num_kills else []
        # Tie with more candidates than kill slots -> nobody dies
        if len(top_targets) > num_kills:
            targets_to_kill = []
            db.add_event(game_id, turn, "NIGHT", "wolf_tie",
                         "I lupi non si sono accordati, nessuno muore.")

        for victim_id in targets_to_kill:
            victim = all_players.get(victim_id)
            if not victim or not victim["is_alive"]:
                continue

            # Check: Criceto immune
            if victim["role"] == Role.CRICETO.value:
                db.add_event(game_id, turn, "NIGHT", "criceto_immune",
                             f"I lupi hanno attaccato {victim['nickname']} (Criceto Mannaro) ma non muore!")
                continue

            # Check: Protected
            if victim_id in protected_ids:
                db.add_event(game_id, turn, "NIGHT", "protected",
                             f"I lupi hanno attaccato {victim['nickname']} ma era protetto!")
                continue

            # Kill the target
            db.kill_player(victim_id)
            death_ids.add(victim_id)
            deaths.append(victim["nickname"])
            db.add_event(game_id, turn, "NIGHT", "wolf_kill",
                         f"I lupi hanno ucciso {victim['nickname']}")

            # If target is Massone, kill the other mason too
            if victim["role"] == Role.MASSONE.value:
                other_mason = _find_other_mason(game_id, victim_id, all_players)
                if other_mason and other_mason["is_alive"]:
                    # Check if other mason is protected
                    if other_mason["id"] in protected_ids:
                        db.add_event(game_id, turn, "NIGHT", "mason_protected",
                                     f"L'altro massone {other_mason['nickname']} era protetto e sopravvive.")
                    else:
                        db.kill_player(other_mason["id"])
                        death_ids.add(other_mason["id"])
                        if other_mason["nickname"] not in deaths:
                            deaths.append(other_mason["nickname"])
                        db.add_event(game_id, turn, "NIGHT", "mason_chain",
                                     f"Anche il massone {other_mason['nickname']} muore insieme al compagno!")

    # ── 4. KAMIKAZE ──
    explode_actions = db.get_actions(game_id, ActionType.EXPLODE.value)
    for ea in explode_actions:
        kamikaze_p = all_players.get(ea["player_id"])
        target_p = all_players.get(ea["target_id"])
        if not kamikaze_p or not kamikaze_p["is_alive"]:
            continue
        if kamikaze_p["id"] in death_ids:
            continue

        # Mark kamikaze as used
        attrs = kamikaze_p.get("attributes", {})
        attrs["kamikaze_used"] = True
        db.update_player(kamikaze_p["id"], {"attributes": attrs})

        # Kamikaze always dies
        explosion_deaths: list[str] = []
        explosion_ids: set[str] = set()

        db.kill_player(kamikaze_p["id"])
        explosion_ids.add(kamikaze_p["id"])
        explosion_deaths.append(kamikaze_p["nickname"])

        if target_p and target_p["is_alive"] and target_p["id"] not in death_ids:
            # Case A: target is Protettore
            if target_p["role"] == Role.PROTETTORE.value:
                db.kill_player(target_p["id"])
                explosion_ids.add(target_p["id"])
                explosion_deaths.append(target_p["nickname"])
                # Also kill whoever was protected
                for pid, protector_id in protector_map.items():
                    if protector_id == target_p["id"]:
                        prot_target = all_players.get(pid)
                        if prot_target and prot_target["is_alive"] and prot_target["id"] not in death_ids and prot_target["id"] not in explosion_ids:
                            db.kill_player(prot_target["id"])
                            explosion_ids.add(prot_target["id"])
                            explosion_deaths.append(prot_target["nickname"])

            # Case B: target is protected
            elif target_p["id"] in protected_ids:
                db.kill_player(target_p["id"])
                explosion_ids.add(target_p["id"])
                explosion_deaths.append(target_p["nickname"])
                # Kill protector too
                protector_id = protector_map.get(target_p["id"])
                if protector_id:
                    protector = all_players.get(protector_id)
                    if protector and protector["is_alive"] and protector["id"] not in death_ids and protector["id"] not in explosion_ids:
                        db.kill_player(protector["id"])
                        explosion_ids.add(protector["id"])
                        explosion_deaths.append(protector["nickname"])

            # Case C: target is Massone
            elif target_p["role"] == Role.MASSONE.value:
                db.kill_player(target_p["id"])
                explosion_ids.add(target_p["id"])
                explosion_deaths.append(target_p["nickname"])
                # Kill other mason
                other_mason = _find_other_mason(game_id, target_p["id"], all_players)
                if other_mason and other_mason["is_alive"] and other_mason["id"] not in death_ids and other_mason["id"] not in explosion_ids:
                    db.kill_player(other_mason["id"])
                    explosion_ids.add(other_mason["id"])
                    explosion_deaths.append(other_mason["nickname"])
                    # If a mason was protected, kill protector too
                    if target_p["id"] in protected_ids:
                        prot_id = protector_map.get(target_p["id"])
                        if prot_id:
                            prot_p = all_players.get(prot_id)
                            if prot_p and prot_p["is_alive"] and prot_p["id"] not in death_ids and prot_p["id"] not in explosion_ids:
                                db.kill_player(prot_p["id"])
                                explosion_ids.add(prot_p["id"])
                                explosion_deaths.append(prot_p["nickname"])
                    if other_mason and other_mason["id"] in protected_ids:
                        prot_id = protector_map.get(other_mason["id"])
                        if prot_id:
                            prot_p = all_players.get(prot_id)
                            if prot_p and prot_p["is_alive"] and prot_p["id"] not in death_ids and prot_p["id"] not in explosion_ids:
                                db.kill_player(prot_p["id"])
                                explosion_ids.add(prot_p["id"])
                                explosion_deaths.append(prot_p["nickname"])

            # Case D: normal target
            else:
                db.kill_player(target_p["id"])
                explosion_ids.add(target_p["id"])
                explosion_deaths.append(target_p["nickname"])

        db.add_event(game_id, turn, "NIGHT", "kamikaze_explode",
                     f"💥 Il Kamikaze esplode! Morti: {', '.join(explosion_deaths)}")
        death_ids.update(explosion_ids)
        for nick in explosion_deaths:
            if nick not in deaths:
                deaths.append(nick)

    # ── 5. VEGGENTE / ORACOLO (info only, already handled in submit_action) ──
    # ── 6. MEDIUM (info stored for night_message) ──
    # ── 7. MASSONI (night 1, info via night_message) ──

    # Remove duplicates from deaths
    deaths = list(dict.fromkeys(deaths))

    # Check win condition
    winner = _check_win(game_id)
    if winner:
        _transition_to_game_over(game_id, winner[0], winner[1])
    else:
        _transition_to_day(game_id, deaths)


def _find_other_mason(game_id: str, mason_id: str, all_players: dict) -> dict | None:
    for pid, p in all_players.items():
        if p["role"] == Role.MASSONE.value and p["id"] != mason_id:
            return p
    return None


def _resolve_day(game_id: str):
    game = db.get_game(game_id)
    turn = game["turn_number"]
    votes = db.get_votes(game_id)
    day_deaths: list[str] = []

    if votes:
        target_counts = Counter(v["target_id"] for v in votes)
        max_votes = max(target_counts.values())
        top_targets = [tid for tid, c in target_counts.items() if c == max_votes]

        # Tie → all tied die
        all_players = {p["id"]: p for p in db.get_game_players(game_id)}
        for tid in top_targets:
            victim = all_players.get(tid)
            if victim and victim["is_alive"]:
                db.kill_player(tid)
                day_deaths.append(victim["nickname"])
                db.add_event(game_id, turn, "DAY", "burned",
                             f"{victim['nickname']} mandato al rogo (era {victim['role']})")

        # Store last burned for Medium (first death)
        if day_deaths:
            first_burned = top_targets[0]
            burned_p = all_players.get(first_burned)
            if burned_p:
                db.update_game(game_id, {
                    "last_day_burned_nick": burned_p["nickname"],
                    "last_day_burned_role": burned_p["role"],
                })

    db.update_game(game_id, {"day_deaths": day_deaths})

    winner = _check_win(game_id)
    if winner:
        _transition_to_game_over(game_id, winner[0], winner[1])
    else:
        _transition_to_night(game_id)


# ── Night messages ─────────────────────────────────────

def _get_night_message(game: dict, player: dict, all_players: list[dict]) -> str | None:
    role = player["role"]
    turn = game["turn_number"]

    # Medium: from night 2+, info about last day's burned
    if role == Role.MEDIUM.value and turn >= 2:
        nick = game.get("last_day_burned_nick", "")
        burned_role = game.get("last_day_burned_role", "")
        if nick and burned_role:
            if burned_role in [r.value for r in WOLF_FACTION]:
                return f"👻 Il morto al rogo ({nick}) ERA un Lupo 🐺"
            else:
                return f"👻 Il morto al rogo ({nick}) NON era un Lupo ✅"
        return "👻 Nessuno è stato mandato al rogo ieri."

    # Massoni: night 1, see each other
    if role == Role.MASSONE.value and turn == 1:
        other = None
        for p in all_players:
            if p["role"] == Role.MASSONE.value and p["id"] != player["id"]:
                other = p
                break
        if other:
            return f"🤝 L'altro Massone è: {other['nickname']}"

    return None


# ── Debug ──────────────────────────────────────────────

@app.post("/reset")
def reset_all():
    db.reset()
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
