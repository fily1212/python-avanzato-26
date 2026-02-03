from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import random;

app = FastAPI()

app.add_middleware(CORSMiddleware, 
                   allow_origins=["http://localhost:5173"], 
                   allow_credentials=True, 
                   allow_methods=["*"], 
                   allow_headers=["*"]
                   )

@app.get("/")
def read_root(id: int):
    nomi = ["Stefano", "Giulio", "Simone", "Mohand", "Samuele"]
    cognomi = ["Chiadò", "Cardillo", "Sarto", "Abdelwahab", "Ragonesi"]

    if id < 0 or id >= len(nomi):
        raise HTTPException(status_code=404, detail="Utente non trovato")

    return {"nome": nomi[id],"cognome": cognomi[id]}
