from fastapi import FastAPI
from pydantic import BaseModel
from tinydb import TinyDB, Query
from typing import List, Optional

app = FastAPI()

db = TinyDB('utenti_db.json')
UserTable = db.table('utenti')

class User(BaseModel):
   nome: str
   email: Optional[str] = "non specificata"
   eta: Optional[int] = None

@app.post("/utenti/", tags=["Database"])
async def salva_utente(user: User):
   id_inserito = UserTable.insert(user.dict())
   return {"messaggio": "Utente salvato!", "id_interno": id_inserito}

@app.get("/utenti/", response_model=List[User], tags=["Database"])
async def lista_utenti():
   return UserTable.all()

@app.get("/utenti/{nome}", tags=["Database"])
async def cerca_utente(nome: str):
   Utente = Query()
   risultato = UserTable.search(Utente.nome == nome)
   return risultato if risultato else {"errore": "Utente non trovato"}