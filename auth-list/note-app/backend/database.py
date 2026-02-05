"""Database initialization and helper functions for TinyDB."""

from tinydb import TinyDB, Query
from typing import Optional
import uuid

# Initialize TinyDB
db = TinyDB("db.json")

# Tables
users_table = db.table("users")
notes_table = db.table("notes")

User = Query()
Note = Query()


def create_user(username: str, hashed_password: str) -> dict:
    """Create a new user and return it."""
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "username": username,
        "hashed_password": hashed_password
    }
    users_table.insert(user)
    return user


def get_user_by_username(username: str) -> Optional[dict]:
    """Get user by username."""
    result = users_table.search(User.username == username)
    return result[0] if result else None


def get_user_by_id(user_id: str) -> Optional[dict]:
    """Get user by ID."""
    result = users_table.search(User.id == user_id)
    return result[0] if result else None


def get_all_users() -> list:
    """Get all users."""
    return users_table.all()


def create_note(title: str, content: str, owner_id: str, created_at: str) -> dict:
    """Create a new note and return it."""
    note_id = str(uuid.uuid4())
    note = {
        "id": note_id,
        "title": title,
        "content": content,
        "owner_id": owner_id,
        "shared_with": [],
        "created_at": created_at
    }
    notes_table.insert(note)
    return note


def get_notes_for_user(user_id: str) -> list:
    """Get all notes owned by or shared with a user."""
    owned = notes_table.search(Note.owner_id == user_id)
    shared = notes_table.search(Note.shared_with.any([user_id]))

    # Combine and deduplicate
    all_notes = {n["id"]: n for n in owned + shared}
    return list(all_notes.values())


def get_note_by_id(note_id: str) -> Optional[dict]:
    """Get note by ID."""
    result = notes_table.search(Note.id == note_id)
    return result[0] if result else None


def share_note(note_id: str, user_id: str) -> Optional[dict]:
    """Share a note with a user."""
    note = get_note_by_id(note_id)
    if not note:
        return None

    if user_id not in note["shared_with"]:
        note["shared_with"].append(user_id)
        notes_table.update({"shared_with": note["shared_with"]}, Note.id == note_id)

    return get_note_by_id(note_id)


def unshare_note(note_id: str, user_id: str) -> Optional[dict]:
    """Remove sharing of a note with a user."""
    note = get_note_by_id(note_id)
    if not note:
        return None

    if user_id in note["shared_with"]:
        note["shared_with"].remove(user_id)
        notes_table.update({"shared_with": note["shared_with"]}, Note.id == note_id)

    return get_note_by_id(note_id)


def delete_note(note_id: str) -> bool:
    """Delete a note by ID."""
    result = notes_table.remove(Note.id == note_id)
    return len(result) > 0
