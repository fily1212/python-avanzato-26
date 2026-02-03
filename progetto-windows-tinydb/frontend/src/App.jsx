import { useState } from 'react'
import './App.css'

function App() {
  const [user, setUser] = useState({ nome: '', cognome: '' });
  const [userId, setUserId] = useState(''); 
  const [showGreeting, setShowGreeting] = useState(false);

  const handleFetchUser = async () => {
    if (!userId) {
      alert("Inserisci un ID!");
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:8000/?id=${userId}`);
      const data = await response.json();
      
      setUser(data);
      setShowGreeting(true);
      
    } catch (error) {
      console.error("Errore nel recupero dati:", error);
    }
  };

  return (
    <>
      <h1>FastAPI + React</h1>

      <div className={`greeting ${showGreeting ? 'fade-in-out' : 'hidden'}`}>
        {user.nome && (
          <h2>Ciao {user.nome} {user.cognome}! 👋</h2>
        )}
      </div>

      <div className="card">
        {/* Campo di testo per l'ID */}
        <input 
          type="number" 
          placeholder="Inserisci ID utente"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          style={{ padding: '10px', borderRadius: '8px', marginRight: '10px' }}
        />
        
        <button onClick={handleFetchUser}>
          Invia ID e Saluta
        </button>
      </div>
    </>
  )
}

export default App