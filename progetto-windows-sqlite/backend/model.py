from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

class User(BaseModel):
    username: str
    email: str
    eta: Optional[int] = None
    is_active: bool = True

@app.post("/users/")
async def create_user(user: User):
   return {"message": f"Utente {user.username} creato!", "data": user}

@app.get("/")
async def root():
   return {"status": "online"}

@app.get("/ripeti-nome/")
async def ripeti_nome(nome: str, volte: int):
   risultato = [nome] * volte

   return {
      "conteggio": volte,
      "risultato": risultato
   }