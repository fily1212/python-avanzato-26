import { useState, useEffect } from 'react'

const API_URL = 'http://localhost:8000'

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '10px',
    borderBottom: '2px solid #e0e0e0',
  },
  title: {
    margin: 0,
    color: '#333',
  },
  button: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#007bff',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
    color: 'white',
  },
  dangerButton: {
    backgroundColor: '#dc3545',
    color: 'white',
  },
  input: {
    width: '100%',
    padding: '10px',
    marginBottom: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    marginBottom: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px',
    minHeight: '100px',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  card: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '15px',
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  sharedBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    backgroundColor: '#28a745',
    color: 'white',
    borderRadius: '3px',
    fontSize: '12px',
    marginLeft: '10px',
  },
  ownedBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    backgroundColor: '#007bff',
    color: 'white',
    borderRadius: '3px',
    fontSize: '12px',
    marginLeft: '10px',
  },
  form: {
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  error: {
    color: '#dc3545',
    marginBottom: '10px',
    padding: '10px',
    backgroundColor: '#f8d7da',
    borderRadius: '5px',
  },
  success: {
    color: '#155724',
    marginBottom: '10px',
    padding: '10px',
    backgroundColor: '#d4edda',
    borderRadius: '5px',
  },
  shareSection: {
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px solid #eee',
  },
  select: {
    padding: '8px',
    marginRight: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
  },
  sharedUsersList: {
    marginTop: '10px',
  },
  sharedUser: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 10px',
    backgroundColor: '#e9ecef',
    borderRadius: '15px',
    marginRight: '5px',
    marginBottom: '5px',
    fontSize: '13px',
  },
  removeShare: {
    marginLeft: '8px',
    cursor: 'pointer',
    color: '#dc3545',
    fontWeight: 'bold',
  },
  toggleLink: {
    color: '#007bff',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [currentUser, setCurrentUser] = useState(null)
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [notes, setNotes] = useState([])
  const [users, setUsers] = useState([])
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [newNoteContent, setNewNoteContent] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const authFetch = async (url, options = {}) => {
    const headers = {
      ...options.headers,
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    if (options.body && !(options.body instanceof URLSearchParams)) {
      headers['Content-Type'] = 'application/json'
    }
    return fetch(`${API_URL}${url}`, { ...options, headers })
  }

  useEffect(() => {
    if (token) {
      loadData()
    }
  }, [token])

  const loadData = async () => {
    try {
      const [meRes, notesRes, usersRes] = await Promise.all([
        authFetch('/me'),
        authFetch('/notes'),
        authFetch('/users'),
      ])

      if (meRes.ok) {
        setCurrentUser(await meRes.json())
      } else {
        handleLogout()
        return
      }

      if (notesRes.ok) {
        setNotes(await notesRes.json())
      }

      if (usersRes.ok) {
        setUsers(await usersRes.json())
      }
    } catch (err) {
      setError('Errore di connessione al server')
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      if (isLogin) {
        const formData = new URLSearchParams()
        formData.append('username', username)
        formData.append('password', password)

        const res = await fetch(`${API_URL}/token`, {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          const data = await res.json()
          localStorage.setItem('token', data.access_token)
          setToken(data.access_token)
          setUsername('')
          setPassword('')
        } else {
          const data = await res.json()
          setError(data.detail || 'Login fallito')
        }
      } else {
        const res = await fetch(`${API_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        })

        if (res.ok) {
          setSuccess('Registrazione completata! Ora puoi effettuare il login.')
          setIsLogin(true)
          setPassword('')
        } else {
          const data = await res.json()
          setError(data.detail || 'Registrazione fallita')
        }
      }
    } catch (err) {
      setError('Errore di connessione al server')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken('')
    setCurrentUser(null)
    setNotes([])
    setUsers([])
  }

  const handleCreateNote = async (e) => {
    e.preventDefault()
    setError('')

    try {
      const res = await authFetch('/notes', {
        method: 'POST',
        body: JSON.stringify({ title: newNoteTitle, content: newNoteContent }),
      })

      if (res.ok) {
        setNewNoteTitle('')
        setNewNoteContent('')
        loadData()
      } else {
        const data = await res.json()
        setError(data.detail || 'Errore nella creazione della nota')
      }
    } catch (err) {
      setError('Errore di connessione al server')
    }
  }

  const handleShare = async (noteId, userId) => {
    try {
      const res = await authFetch(`/notes/${noteId}/share`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      })

      if (res.ok) {
        loadData()
      } else {
        const data = await res.json()
        setError(data.detail || 'Errore nella condivisione')
      }
    } catch (err) {
      setError('Errore di connessione al server')
    }
  }

  const handleRemoveShare = async (noteId, userId) => {
    try {
      const res = await authFetch(`/notes/${noteId}/share/${userId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        loadData()
      } else {
        const data = await res.json()
        setError(data.detail || 'Errore nella rimozione della condivisione')
      }
    } catch (err) {
      setError('Errore di connessione al server')
    }
  }

  const getUsernameById = (userId) => {
    const user = users.find((u) => u.id === userId)
    return user ? user.username : userId
  }

  if (!token) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Note Personali</h1>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <div style={styles.form}>
          <h2>{isLogin ? 'Login' : 'Registrazione'}</h2>
          <form onSubmit={handleAuth}>
            <input
              style={styles.input}
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              style={styles.input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button style={{ ...styles.button, ...styles.primaryButton }} type="submit">
              {isLogin ? 'Accedi' : 'Registrati'}
            </button>
          </form>
          <p style={{ marginTop: '15px' }}>
            {isLogin ? 'Non hai un account? ' : 'Hai già un account? '}
            <span style={styles.toggleLink} onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? 'Registrati' : 'Accedi'}
            </span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Note Personali</h1>
        <div>
          <span style={{ marginRight: '15px' }}>Ciao, {currentUser?.username}</span>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.form}>
        <h3>Crea una nuova nota</h3>
        <form onSubmit={handleCreateNote}>
          <input
            style={styles.input}
            type="text"
            placeholder="Titolo"
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            required
          />
          <textarea
            style={styles.textarea}
            placeholder="Contenuto"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            required
          />
          <button style={{ ...styles.button, ...styles.primaryButton }} type="submit">
            Crea Nota
          </button>
        </form>
      </div>

      <h2>Le tue note</h2>
      {notes.length === 0 ? (
        <p>Non hai ancora nessuna nota.</p>
      ) : (
        notes.map((note) => (
          <div key={note.id} style={styles.card}>
            <h3>
              {note.title}
              {note.is_owner ? (
                <span style={styles.ownedBadge}>Mia</span>
              ) : (
                <span style={styles.sharedBadge}>Condivisa con me</span>
              )}
            </h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{note.content}</p>
            <small style={{ color: '#888' }}>
              Creata: {new Date(note.created_at).toLocaleString('it-IT')}
            </small>

            {note.is_owner && (
              <div style={styles.shareSection}>
                <strong>Condividi con:</strong>
                <div style={{ marginTop: '10px' }}>
                  <select
                    style={styles.select}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleShare(note.id, e.target.value)
                        e.target.value = ''
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Seleziona utente...
                    </option>
                    {users
                      .filter((u) => !note.shared_with.includes(u.id))
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username}
                        </option>
                      ))}
                  </select>
                </div>

                {note.shared_with.length > 0 && (
                  <div style={styles.sharedUsersList}>
                    <strong>Condivisa con:</strong>
                    <div style={{ marginTop: '5px' }}>
                      {note.shared_with.map((userId) => (
                        <span key={userId} style={styles.sharedUser}>
                          {getUsernameById(userId)}
                          <span
                            style={styles.removeShare}
                            onClick={() => handleRemoveShare(note.id, userId)}
                          >
                            ×
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

export default App
