"""
Database layer – all TinyDB operations.
"""
from __future__ import annotations

import hashlib
import os
import random
import string
import time
import uuid
from collections import Counter

from tinydb import TinyDB, Query
from tinydb.storages import JSONStorage
from tinydb.middlewares import CachingMiddleware

from models import (
    GameState, Role, ActionType,
    WOLF_FACTION, NEUTRAL_FACTION,
    get_role_distribution,
)

Q = Query()


def _uid() -> str:
    return uuid.uuid4().hex[:12]


def _now() -> float:
    return time.time()


def _game_code() -> str:
    return "".join(random.choices(string.ascii_uppercase, k=5))


def _hash_pw(password: str, salt: str | None = None) -> tuple[str, str]:
    if salt is None:
        salt = os.urandom(16).hex()
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()
    return h, salt


class Database:
    def __init__(self, path: str = "db.json"):
        self.db = TinyDB(path, storage=CachingMiddleware(JSONStorage))
        self.users = self.db.table("users")
        self.sessions = self.db.table("sessions")
        self.games = self.db.table("games")
        self.players = self.db.table("players")
        self.actions = self.db.table("actions")
        self.votes = self.db.table("votes")
        self.guesses = self.db.table("guesses")

    def close(self):
        self.db.close()

    # ── Users ──────────────────────────────────────────

    def create_user(self, username: str, password: str) -> dict:
        if self.users.get(Q.username == username):
            raise ValueError("Username già in uso")
        pw_hash, salt = _hash_pw(password)
        user = {
            "id": _uid(),
            "username": username,
            "password_hash": pw_hash,
            "salt": salt,
            "created_at": _now(),
            "stats": {"games": 0, "wins": 0, "wolf_wins": 0, "village_wins": 0},
        }
        self.users.insert(user)
        return user

    def verify_user(self, username: str, password: str) -> dict | None:
        user = self.users.get(Q.username == username)
        if not user:
            return None
        pw_hash, _ = _hash_pw(password, user["salt"])
        if pw_hash != user["password_hash"]:
            return None
        return user

    def get_user(self, user_id: str) -> dict | None:
        return self.users.get(Q.id == user_id)

    def get_user_by_username(self, username: str) -> dict | None:
        return self.users.get(Q.username == username)

    def update_user_stats(self, user_id: str, field: str, increment: int = 1):
        user = self.get_user(user_id)
        if user:
            stats = user.get("stats", {})
            stats[field] = stats.get(field, 0) + increment
            self.users.update({"stats": stats}, Q.id == user_id)

    # ── Sessions ───────────────────────────────────────

    def create_session(self, user_id: str) -> str:
        sid = uuid.uuid4().hex
        self.sessions.insert({"id": sid, "user_id": user_id, "created_at": _now()})
        return sid

    def get_session(self, sid: str) -> dict | None:
        return self.sessions.get(Q.id == sid)

    def delete_session(self, sid: str):
        self.sessions.remove(Q.id == sid)

    # ── Games ──────────────────────────────────────────

    def create_game(self, creator_id: str, target_players: int) -> dict:
        game_id = _game_code()
        # Ensure unique
        while self.games.get(Q.id == game_id):
            game_id = _game_code()
        game = {
            "id": game_id,
            "state": GameState.LOBBY.value,
            "creator_id": creator_id,
            "target_players": target_players,
            "turn_number": 0,
            "phase_end_time": 0,
            "roles_in_game": {},
            "winners": "",
            "winner_detail": "",
            "last_day_burned_nick": "",
            "last_day_burned_role": "",
            "night_deaths": [],
            "day_deaths": [],
            "events": [],
            "created_at": _now(),
        }
        self.games.insert(game)
        return game

    def get_game(self, game_id: str) -> dict | None:
        return self.games.get(Q.id == game_id)

    def update_game(self, game_id: str, data: dict):
        self.games.update(data, Q.id == game_id)

    def add_event(self, game_id: str, turn: int, phase: str, etype: str, detail: str):
        game = self.get_game(game_id)
        if game:
            events = game.get("events", [])
            events.append({
                "turn": turn, "phase": phase, "type": etype,
                "detail": detail, "ts": _now(),
            })
            self.update_game(game_id, {"events": events})

    def list_open_games(self) -> list[dict]:
        return self.games.search(Q.state == GameState.LOBBY.value)

    def list_finished_games_for_user(self, user_id: str) -> list[dict]:
        players = self.players.search(Q.user_id == user_id)
        game_ids = {p["game_id"] for p in players}
        result = []
        for gid in game_ids:
            g = self.get_game(gid)
            if g and g["state"] == GameState.GAME_OVER.value:
                result.append(g)
        result.sort(key=lambda x: x.get("created_at", 0), reverse=True)
        return result

    # ── Players ────────────────────────────────────────

    def add_player(self, game_id: str, user_id: str, nickname: str) -> dict:
        player = {
            "id": _uid(),
            "game_id": game_id,
            "user_id": user_id,
            "nickname": nickname,
            "role": "",
            "original_role": "",
            "is_alive": True,
            "attributes": {},
        }
        self.players.insert(player)
        return player

    def get_player(self, player_id: str) -> dict | None:
        return self.players.get(Q.id == player_id)

    def get_player_in_game(self, game_id: str, user_id: str) -> dict | None:
        return self.players.get((Q.game_id == game_id) & (Q.user_id == user_id))

    def get_game_players(self, game_id: str, alive_only: bool = False) -> list[dict]:
        ps = self.players.search(Q.game_id == game_id)
        if alive_only:
            ps = [p for p in ps if p["is_alive"]]
        return ps

    def update_player(self, player_id: str, data: dict):
        self.players.update(data, Q.id == player_id)

    def kill_player(self, player_id: str):
        self.players.update({"is_alive": False}, Q.id == player_id)

    def find_active_game_for_user(self, user_id: str) -> str | None:
        players = self.players.search(Q.user_id == user_id)
        for p in players:
            g = self.get_game(p["game_id"])
            if g and g["state"] not in (GameState.GAME_OVER.value,):
                return g["id"]
        return None

    # ── Actions ────────────────────────────────────────

    def upsert_action(self, game_id: str, player_id: str, target_id: str, action_type: str):
        existing = self.actions.get(
            (Q.game_id == game_id) & (Q.player_id == player_id) & (Q.action_type == action_type)
        )
        data = {
            "game_id": game_id, "player_id": player_id,
            "target_id": target_id, "action_type": action_type,
        }
        if existing:
            self.actions.update(
                data,
                (Q.game_id == game_id) & (Q.player_id == player_id) & (Q.action_type == action_type),
            )
        else:
            self.actions.insert(data)

    def get_actions(self, game_id: str, action_type: str | None = None) -> list[dict]:
        if action_type:
            return self.actions.search(
                (Q.game_id == game_id) & (Q.action_type == action_type)
            )
        return self.actions.search(Q.game_id == game_id)

    def get_player_action(self, game_id: str, player_id: str, action_type: str) -> dict | None:
        return self.actions.get(
            (Q.game_id == game_id) & (Q.player_id == player_id) & (Q.action_type == action_type)
        )

    def clear_actions(self, game_id: str):
        self.actions.remove(Q.game_id == game_id)

    # ── Votes ──────────────────────────────────────────

    def upsert_vote(self, game_id: str, player_id: str, target_id: str):
        existing = self.votes.get(
            (Q.game_id == game_id) & (Q.player_id == player_id)
        )
        data = {"game_id": game_id, "player_id": player_id, "target_id": target_id}
        if existing:
            self.votes.update(data, (Q.game_id == game_id) & (Q.player_id == player_id))
        else:
            self.votes.insert(data)

    def get_votes(self, game_id: str) -> list[dict]:
        return self.votes.search(Q.game_id == game_id)

    def clear_votes(self, game_id: str):
        self.votes.remove(Q.game_id == game_id)

    # ── Guesses ────────────────────────────────────────

    def upsert_guess(self, game_id: str, player_id: str, target_id: str, guessed_role: str):
        existing = self.guesses.get(
            (Q.game_id == game_id) & (Q.player_id == player_id) & (Q.target_id == target_id)
        )
        data = {
            "game_id": game_id, "player_id": player_id,
            "target_id": target_id, "guessed_role": guessed_role,
        }
        if existing:
            self.guesses.update(data,
                (Q.game_id == game_id) & (Q.player_id == player_id) & (Q.target_id == target_id))
        else:
            self.guesses.insert(data)

    def get_guesses(self, game_id: str, player_id: str | None = None) -> list[dict]:
        if player_id:
            return self.guesses.search(
                (Q.game_id == game_id) & (Q.player_id == player_id))
        return self.guesses.search(Q.game_id == game_id)

    # ── Utility ────────────────────────────────────────

    def reset(self):
        self.db.drop_tables()
