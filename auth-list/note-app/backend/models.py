"""Pydantic models for request/response validation."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# User models
class UserCreate(BaseModel):
    username: str
    password: str


class UserRead(BaseModel):
    id: str
    username: str


# Token models
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[str] = None


# Note models
class NoteCreate(BaseModel):
    title: str
    content: str


class NoteRead(BaseModel):
    id: str
    title: str
    content: str
    owner_id: str
    shared_with: list[str]
    created_at: str
    is_owner: bool = True


class NoteShare(BaseModel):
    user_id: str
