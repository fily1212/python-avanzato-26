# Note Personali

Applicazione web per la gestione di note personali con funzionalità di condivisione tra utenti.

## Funzionalità

- Registrazione e login utenti con autenticazione JWT
- Creazione di note personali
- Condivisione note con altri utenti
- Visualizzazione note proprie e condivise

## Tecnologie

### Backend
- **FastAPI** - Framework web Python
- **TinyDB** - Database JSON leggero
- **JWT (python-jose)** - Autenticazione token-based
- **Passlib/Bcrypt** - Hashing password

### Frontend
- **React 18** - Libreria UI
- **Vite** - Build tool

## Setup

### Backend

```bash
cd note-app/backend

# Crea virtual environment
python3 -m venv venv

# Attiva virtual environment
source venv/bin/activate  # Linux/Mac
# oppure
.\venv\Scripts\activate   # Windows

# Installa dipendenze
pip install -r requirements.txt

# Avvia il server
uvicorn main:app --reload --port 8000
```

Il backend sarà disponibile su `http://localhost:8000`

API docs disponibili su `http://localhost:8000/docs`

### Frontend

```bash
cd note-app/frontend

# Installa dipendenze
npm install

# Avvia in modalità sviluppo
npm run dev
```

Il frontend sarà disponibile su `http://localhost:5173`

## API Endpoints

| Metodo | Endpoint | Descrizione | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Registra nuovo utente | No |
| POST | `/token` | Login (ottieni token) | No |
| GET | `/me` | Info utente corrente | Si |
| GET | `/users` | Lista utenti | Si |
| GET | `/notes` | Lista note | Si |
| POST | `/notes` | Crea nota | Si |
| POST | `/notes/{id}/share` | Condividi nota | Si |
| DELETE | `/notes/{id}/share/{user_id}` | Rimuovi condivisione | Si |

## Test End-to-End

1. Avvia backend su `http://localhost:8000`
2. Avvia frontend su `http://localhost:5173`
3. Registra due utenti (es. user1, user2)
4. Login come user1
5. Crea una nota
6. Condividi la nota con user2
7. Logout e login come user2
8. Verifica che la nota condivisa appaia
9. Verifica che user2 NON possa vedere note non condivise di user1

## Struttura Progetto

```
note-app/
├── backend/
│   ├── requirements.txt      # Dipendenze Python
│   ├── database.py           # Inizializzazione TinyDB
│   ├── models.py             # Modelli Pydantic
│   ├── auth.py               # Logica JWT e autenticazione
│   ├── main.py               # FastAPI app e endpoints
│   └── db.json               # Database (generato automaticamente)
├── frontend/
│   ├── package.json          # Dipendenze React
│   ├── vite.config.js        # Configurazione Vite
│   ├── index.html            # Entry point HTML
│   └── src/
│       ├── main.jsx          # Entry point React
│       └── App.jsx           # Componente principale
└── README.md
```

## Note di Sicurezza

- Cambiare `SECRET_KEY` in `auth.py` in produzione
- Utilizzare HTTPS in produzione
- Considerare l'uso di un database più robusto per ambienti production
