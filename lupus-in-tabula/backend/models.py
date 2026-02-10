"""
Models & constants for Lupus in Tabula.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


# ── Enums ──────────────────────────────────────────────

class GameState(str, Enum):
    LOBBY = "LOBBY"
    ROLE_REVEAL = "ROLE_REVEAL"
    NIGHT = "NIGHT"
    DAY = "DAY"
    GAME_OVER = "GAME_OVER"


class Role(str, Enum):
    LUPO = "Lupo"
    VEGGENTE = "Veggente"
    MEDIUM = "Medium"
    INDEMONIATO = "Indemoniato"
    PROTETTORE = "Protettore"
    KAMIKAZE = "Kamikaze"
    MASSONE = "Massone"
    CRICETO = "Criceto Mannaro"
    MITOMANE = "Mitomane"
    ORACOLO = "Oracolo"
    VILLICO = "Villico"


class ActionType(str, Enum):
    KILL = "KILL"
    INSPECT = "INSPECT"
    INSPECT_ROLE = "INSPECT_ROLE"
    PROTECT = "PROTECT"
    EXPLODE = "EXPLODE"
    COPY = "COPY"


# ── Factions ───────────────────────────────────────────

WOLF_FACTION = {Role.LUPO}  # Only real wolves (see each other)
EVIL_FACTION = {Role.LUPO, Role.KAMIKAZE, Role.ORACOLO, Role.INDEMONIATO}  # Win with wolves
VILLAGE_FACTION = {
    Role.VEGGENTE, Role.MEDIUM,
    Role.PROTETTORE, Role.MASSONE, Role.MITOMANE, Role.VILLICO,
}
NEUTRAL_FACTION = {Role.CRICETO}

ROLE_EMOJI = {
    Role.LUPO: "🐺", Role.VEGGENTE: "🔮", Role.MEDIUM: "👻",
    Role.INDEMONIATO: "😈", Role.PROTETTORE: "🛡️", Role.KAMIKAZE: "💣",
    Role.MASSONE: "🤝", Role.CRICETO: "🐹", Role.MITOMANE: "🎭",
    Role.ORACOLO: "🔮", Role.VILLICO: "🏘️",
}

# Allowed night actions per role
ROLE_ACTIONS: dict[str, list[str]] = {
    Role.LUPO.value: [ActionType.KILL.value],
    Role.VEGGENTE.value: [ActionType.INSPECT.value],
    Role.ORACOLO.value: [ActionType.INSPECT_ROLE.value],
    Role.PROTETTORE.value: [ActionType.PROTECT.value],
    Role.KAMIKAZE.value: [ActionType.KILL.value, ActionType.EXPLODE.value],
    Role.MITOMANE.value: [ActionType.COPY.value],
}

NIGHT_DURATION = 180   # 3 min
DAY_DURATION = 180     # 3 min
REVEAL_DURATION = 120  # 2 min


# ── Role distribution ─────────────────────────────────


def get_role_distribution(n: int) -> list[Role]:
    if n < 6:
        raise ValueError("Minimo 6 giocatori richiesti")

    # 1. Base fissa per 6 giocatori
    # (Lupo, Veggente, 4 Villici)
    roles = [
        Role.LUPO,
        Role.VEGGENTE,
        Role.VILLICO, Role.VILLICO, Role.VILLICO, Role.VILLICO
    ]

    # 2. Aggiunte incrementali
    if n >= 7:  roles.append(Role.LUPO)
    if n >= 8:  roles.append(Role.VILLICO)
    if n >= 9:  roles.append(Role.MEDIUM)
    if n >= 10: roles.append(Role.INDEMONIATO)
    if n >= 11: roles.append(Role.PROTETTORE)
    if n >= 12: roles.append(Role.ORACOLO)

    # 3. Logica speciale per 13/14 (Massoni)
    # A 13 si aggiunge un Villico.
    # A 14 quel Villico sparisce e arrivano 2 Massoni (facendo saltare il conto da 12 a 14).
    if n == 13:
        roles.append(Role.VILLICO)
    elif n >= 14:
        roles.extend([Role.MASSONE, Role.MASSONE])

    if n >= 15: roles.append(Role.CRICETO)
    if n >= 16: roles.append(Role.KAMIKAZE)
    if n >= 17: roles.append(Role.MITOMANE)
    if n >= 18: roles.append(Role.VILLICO)
    if n >= 19: roles.append(Role.LUPO)
    if n >= 20: roles.append(Role.VILLICO)
    if n >= 21: roles.append(Role.INDEMONIATO) # Secondo Indemoniato
    if n >= 22: roles.append(Role.CRICETO)     # Secondo Criceto

    # Fallback di sicurezza: se n > 22, riempiamo i buchi con Villici
    while len(roles) < n:
        roles.append(Role.VILLICO)

    return roles[:n]

# def get_role_distribution(n: int) -> list[Role]:
#     if n < 6:
#         raise ValueError("Minimo 6 giocatori")

#     roles: list[Role] = []

#     # Core village (always)
#     roles.extend([Role.VEGGENTE, Role.PROTETTORE, Role.VILLICO, Role.VILLICO])

#     # Wolf faction size
#     wolf_count = max(1, n // 4)

#     # Build wolf roster: replace some wolves with specials
#     wolves: list[Role] = []
#     remaining_wolves = wolf_count
#     if remaining_wolves >= 3:
#         wolves.append(Role.ORACOLO)
#         wolves.append(Role.KAMIKAZE)
#         remaining_wolves -= 2
#     elif remaining_wolves >= 2:
#         wolves.append(Role.KAMIKAZE)
#         remaining_wolves -= 1
#     wolves.extend([Role.LUPO] * remaining_wolves)
#     roles.extend(wolves)

#     # Optional village/neutral (in priority order)
#     remaining = n - len(roles)
#     optional = [Role.MEDIUM, Role.INDEMONIATO, Role.MITOMANE, Role.CRICETO, Role.MASSONE, Role.MASSONE]
#     for role in optional:
#         if remaining <= 0:
#             break
#         roles.append(role)
#         remaining -= 1

#     # Fill rest with Villici
#     roles.extend([Role.VILLICO] * max(0, remaining))
#     return roles


# ── Request models ─────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=4, max_length=50)

class LoginRequest(BaseModel):
    username: str
    password: str

class CreateGameRequest(BaseModel):
    target_players: int = Field(..., ge=6, le=30)

class ActionRequest(BaseModel):
    target_id: str
    action_type: ActionType

class VoteRequest(BaseModel):
    target_id: str

class GuessRequest(BaseModel):
    target_id: str
    guessed_role: str


# ── Response models ────────────────────────────────────

class PlayerPublic(BaseModel):
    id: str
    nickname: str
    is_alive: bool

class PlayerSelf(BaseModel):
    id: str
    nickname: str
    role: str
    is_alive: bool
    attributes: dict = {}

class WolfVoteInfo(BaseModel):
    votes: dict[str, str] = {}

class UserInfo(BaseModel):
    id: str
    username: str
    current_game: Optional[str] = None
    stats: dict = {}
