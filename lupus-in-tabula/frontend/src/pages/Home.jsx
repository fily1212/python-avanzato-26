import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { api } from '../api';
import Navbar from '../components/Navbar';

export default function Home() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('menu');
  const [targetPlayers, setTargetPlayers] = useState(8);
  const [joinCode, setJoinCode] = useState('');
  const [games, setGames] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadGames = async () => {
    try { setGames(await api.listGames()); } catch { setGames([]); }
  };

  const handleCreate = async () => {
    setError(''); setLoading(true);
    try {
      const res = await api.createGame(targetPlayers);
      await refresh();
      navigate(`/game/${res.game_id}`);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleJoin = async (code) => {
    setError(''); setLoading(true);
    try {
      const res = await api.joinGame(code || joinCode);
      await refresh();
      navigate(`/game/${res.game_id}`);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-12">
        {/* Stats card */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 mb-8">
          <h3 className="text-sm font-semibold text-[var(--text-dim)] mb-3">Le tue statistiche</h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { label: 'Partite', val: user?.stats?.games || 0 },
              { label: 'Vittorie', val: user?.stats?.wins || 0 },
              { label: 'Come Lupo', val: user?.stats?.wolf_wins || 0 },
              { label: 'Come Villaggio', val: user?.stats?.village_wins || 0 },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold">{s.val}</div>
                <div className="text-[10px] text-[var(--text-dim)]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Menu */}
        {mode === 'menu' && (
          <div className="space-y-3">
            <button onClick={() => setMode('create')}
              className="w-full py-3.5 bg-[var(--accent)] text-white rounded-2xl font-semibold text-base hover:opacity-90 transition cursor-pointer border-none">
              🎮 Crea Partita
            </button>
            <button onClick={() => { setMode('join'); loadGames(); }}
              className="w-full py-3.5 bg-[var(--bg-elevated)] border border-[var(--border)] text-white rounded-2xl font-semibold text-base hover:border-[var(--accent)] transition cursor-pointer">
              🚪 Unisciti a Partita
            </button>
            <button onClick={() => navigate('/history')}
              className="w-full py-3.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-dim)] rounded-2xl font-semibold text-base hover:border-[var(--text-dim)] transition cursor-pointer">
              📜 Storico Partite
            </button>
          </div>
        )}

        {/* Create */}
        {mode === 'create' && (
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 space-y-5">
            <h2 className="text-lg font-bold">Crea Partita</h2>
            <div>
              <label className="block text-xs text-[var(--text-dim)] mb-1">Numero giocatori</label>
              <input type="number" min={6} max={30} value={targetPlayers}
                onChange={(e) => setTargetPlayers(Number(e.target.value))}
                className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-xl px-4 py-3 text-lg font-mono focus:border-[var(--accent)] outline-none transition" />
            </div>
            <button onClick={handleCreate} disabled={loading}
              className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-40 cursor-pointer border-none">
              {loading ? 'Creazione...' : 'Crea'}
            </button>
            <button onClick={() => setMode('menu')}
              className="w-full py-2 text-[var(--text-dim)] text-sm hover:text-white transition bg-transparent border-none cursor-pointer">
              ← Indietro
            </button>
          </div>
        )}

        {/* Join */}
        {mode === 'join' && (
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 space-y-5">
            <h2 className="text-lg font-bold">Unisciti a Partita</h2>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={5} placeholder="CODICE"
              className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-xl px-4 py-3 text-2xl font-mono text-center tracking-[0.5em] focus:border-[var(--accent)] outline-none transition uppercase" />
            <button onClick={() => handleJoin()} disabled={loading || joinCode.length < 5}
              className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-40 cursor-pointer border-none">
              {loading ? 'Accesso...' : 'Unisciti'}
            </button>

            {games.length > 0 && (
              <div>
                <p className="text-xs text-[var(--text-dim)] mb-2">Partite aperte:</p>
                <div className="space-y-2">
                  {games.map((g) => (
                    <button key={g.id} onClick={() => handleJoin(g.id)}
                      className="w-full text-left bg-[var(--bg-dark)] rounded-xl px-4 py-3 hover:border-[var(--accent)] border border-transparent transition cursor-pointer">
                      <span className="font-mono text-[var(--accent)] font-bold tracking-widest">{g.id}</span>
                      <span className="ml-3 text-[var(--text-dim)] text-sm">{g.current_players}/{g.target_players}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setMode('menu')}
              className="w-full py-2 text-[var(--text-dim)] text-sm hover:text-white transition bg-transparent border-none cursor-pointer">
              ← Indietro
            </button>
          </div>
        )}

        {error && <p className="text-[var(--accent)] text-sm text-center mt-4">{error}</p>}
      </div>
    </div>
  );
}
