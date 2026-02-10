import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import Navbar from '../components/Navbar';

const ROLE_EMOJI = {
  Lupo: '🐺', Veggente: '🔮', Medium: '👻', Indemoniato: '😈',
  Protettore: '🛡️', Kamikaze: '💣', Massone: '🤝',
  'Criceto Mannaro': '🐹', Mitomane: '🎭', Oracolo: '🔮', Villico: '🏘️',
};

function HistoryList() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.history().then(setGames).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center pt-20">
      <span className="text-4xl animate-pulse">📜</span>
    </div>
  );

  if (!games.length) return (
    <div className="text-center pt-16">
      <span className="text-5xl block mb-3">📭</span>
      <p className="text-[var(--text-dim)]">Nessuna partita completata.</p>
      <Link to="/" className="text-[var(--accent)] text-sm mt-2 inline-block no-underline hover:underline">
        Torna alla Home
      </Link>
    </div>
  );

  return (
    <div className="space-y-3">
      {games.map(g => (
        <Link to={`/history/${g.game_id}`} key={g.game_id}
          className="flex items-center gap-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-5 py-4 hover:border-[var(--accent)]/30 transition no-underline text-inherit">
          <span className="text-2xl">
            {g.winners === 'Lupi' ? '🐺' : g.winners === 'Villaggio' ? '🏘️' : '🐹'}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[var(--accent)] font-bold">{g.game_id}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold
                ${g.player_won ? 'bg-[var(--green)]/20 text-[var(--green)]' : 'bg-[var(--accent)]/20 text-[var(--accent)]'}`}>
                {g.player_won ? 'VITTORIA' : 'SCONFITTA'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-dim)] mt-0.5">
              Ruolo: {ROLE_EMOJI[g.player_role]} {g.player_role} &middot;
              Turni: {g.turns} &middot;
              Vincitore: {g.winners}
            </p>
          </div>
          <span className="text-[var(--text-dim)] text-sm">→</span>
        </Link>
      ))}
    </div>
  );
}

function HistoryDetail() {
  const { gameId } = useParams();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.gameHistory(gameId).then(setGame).catch(() => {}).finally(() => setLoading(false));
  }, [gameId]);

  if (loading) return (
    <div className="flex justify-center pt-20"><span className="text-4xl animate-pulse">📜</span></div>
  );

  if (!game) return (
    <div className="text-center pt-16">
      <p className="text-[var(--text-dim)]">Partita non trovata.</p>
      <Link to="/history" className="text-[var(--accent)] text-sm mt-2 inline-block no-underline hover:underline">
        ← Torna alla cronologia
      </Link>
    </div>
  );

  const WOLF_ROLES = ['Lupo'];

  return (
    <div>
      <Link to="/history" className="text-[var(--accent)] text-xs no-underline hover:underline mb-4 inline-block">
        ← Tutte le partite
      </Link>

      {/* Header */}
      <div className="text-center mb-8">
        <span className="text-5xl block mb-2">
          {game.winners === 'Lupi' ? '🐺' : game.winners === 'Villaggio' ? '🏘️' : '🐹'}
        </span>
        <h2 className="text-2xl font-bold font-mono text-[var(--accent)]">{game.game_id}</h2>
        <p className="text-[var(--text-dim)] text-sm">
          Vincitore: <span className="font-semibold text-white">{game.winners}</span> &middot; Turni: {game.turns}
        </p>
      </div>

      {/* Roles */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 mb-6">
        <h3 className="text-sm font-bold mb-3">Ruoli</h3>
        <div className="grid grid-cols-2 gap-2">
          {(game.players || []).map((p, i) => (
            <div key={i} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2
              ${p.is_alive ? 'bg-[var(--bg-elevated)]' : 'bg-gray-900/20 opacity-50'}`}>
              <span>{ROLE_EMOJI[p.role] || '❓'}</span>
              <span className="font-medium">{p.nickname}</span>
              <span className={WOLF_ROLES.includes(p.role) ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'}>
                ({p.role}{p.final_role && p.final_role !== p.role ? ` → ${p.final_role}` : ''})
              </span>
              {!p.is_alive && <span className="ml-auto">💀</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Events */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
        <h3 className="text-sm font-bold mb-3">📜 Eventi</h3>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {(game.events || []).map((ev, i) => (
            <div key={i} className="text-xs text-[var(--text-dim)] bg-[var(--bg-dark)] rounded-lg px-3 py-2">
              <span className="font-mono mr-2">
                {ev.phase === 'NIGHT' ? '🌙' : ev.phase === 'DAY' ? '☀️' : '🏁'}
                T{ev.turn}
              </span>
              {ev.detail}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function History() {
  const { gameId } = useParams();

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6">
          {gameId ? '' : '📜 Cronologia Partite'}
        </h1>
        {gameId ? <HistoryDetail /> : <HistoryList />}
      </div>
    </div>
  );
}
