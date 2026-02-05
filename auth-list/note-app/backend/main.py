"""FastAPI application with all endpoints."""

from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm

from models import UserCreate, UserRead, Token, NoteCreate, NoteRead, NoteShare
from auth import hash_password, verify_password, create_access_token, get_current_user
from database import (
    create_user, get_user_by_username, get_all_users,
    create_note, get_notes_for_user, get_note_by_id,
    share_note, unshare_note
)

app = FastAPI(title="Note Personali API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/register", response_model=UserRead)
async def register(user: UserCreate):
    """Register a new user."""
    # Check if username exists
    if get_user_by_username(user.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Create user with hashed password
    hashed_password = hash_password(user.password)
    new_user = create_user(user.username, hashed_password)

    return UserRead(id=new_user["id"], username=new_user["username"])


@app.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login and get access token."""
    user = get_user_by_username(form_data.username)

    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user["id"]})
    return Token(access_token=access_token, token_type="bearer")


@app.get("/users", response_model=list[UserRead])
async def list_users(current_user: dict = Depends(get_current_user)):
    """Get all users (for sharing notes)."""
    users = get_all_users()
    return [
        UserRead(id=u["id"], username=u["username"])
        for u in users
        if u["id"] != current_user["id"]  # Exclude current user
    ]


@app.get("/notes", response_model=list[NoteRead])
async def list_notes(current_user: dict = Depends(get_current_user)):
    """Get all notes owned by or shared with current user."""
    notes = get_notes_for_user(current_user["id"])
    return [
        NoteRead(
            id=n["id"],
            title=n["title"],
            content=n["content"],
            owner_id=n["owner_id"],
            shared_with=n["shared_with"],
            created_at=n["created_at"],
            is_owner=(n["owner_id"] == current_user["id"])
        )
        for n in notes
    ]


@app.post("/notes", response_model=NoteRead)
async def create_new_note(note: NoteCreate, current_user: dict = Depends(get_current_user)):
    """Create a new note."""
    created_at = datetime.now(timezone.utc).isoformat()
    new_note = create_note(
        title=note.title,
        content=note.content,
        owner_id=current_user["id"],
        created_at=created_at
    )
    return NoteRead(
        id=new_note["id"],
        title=new_note["title"],
        content=new_note["content"],
        owner_id=new_note["owner_id"],
        shared_with=new_note["shared_with"],
        created_at=new_note["created_at"],
        is_owner=True
    )


@app.post("/notes/{note_id}/share", response_model=NoteRead)
async def share_note_with_user(
    note_id: str,
    share: NoteShare,
    current_user: dict = Depends(get_current_user)
):
    """Share a note with another user."""
    note = get_note_by_id(note_id)

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if note["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can share this note")

    if share.user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot share note with yourself")

    updated_note = share_note(note_id, share.user_id)
    return NoteRead(
        id=updated_note["id"],
        title=updated_note["title"],
        content=updated_note["content"],
        owner_id=updated_note["owner_id"],
        shared_with=updated_note["shared_with"],
        created_at=updated_note["created_at"],
        is_owner=True
    )


@app.delete("/notes/{note_id}/share/{user_id}", response_model=NoteRead)
async def remove_share(
    note_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove sharing of a note with a user."""
    note = get_note_by_id(note_id)

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if note["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can modify sharing")

    updated_note = unshare_note(note_id, user_id)
    return NoteRead(
        id=updated_note["id"],
        title=updated_note["title"],
        content=updated_note["content"],
        owner_id=updated_note["owner_id"],
        shared_with=updated_note["shared_with"],
        created_at=updated_note["created_at"],
        is_owner=True
    )


@app.get("/me", response_model=UserRead)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info."""
    return UserRead(id=current_user["id"], username=current_user["username"])
