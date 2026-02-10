import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGameState } from '../useGameState';
import { useAuth } from '../useAuth.jsx';
import { api } from '../api';
import Navbar from '../components/Navbar';
import PlayerCard from '../components/PlayerCard';
import Timer from '../components/Timer';

const ROLE_EMOJI = {
  Lupo: '🐺', Veggente: '🔮', Medium: '👻', Indemoniato: '😈',
  Protettore: '🛡️', Kamikaze: '💣', Massone: '🤝',
  'Criceto Mannaro': '🐹', Mitomane: '🎭', Oracolo: '🔮', Villico: '🏘️',
};

const ROLE_DESC = {
  Lupo: 'Uccide un villico ogni notte',
  Veggente: 'Vede se un giocatore è Lupo o no',
  Medium: 'Dalla notte 2, scopre se il morto al rogo era Lupo',
  Indemoniato: 'Umano, ma vince con i Lupi',
  Protettore: 'Protegge un giocatore ogni notte',
  Kamikaze: 'Vince con i Lupi. Può esplodere una volta (attiva modalità per selezionare)',
  Massone: 'Si conoscono tra loro la prima notte',
  'Criceto Mannaro': 'Neutrale, immune ai lupi, vince da solo se sopravvive',
  Mitomane: 'Notte 2: copia il ruolo di un bersaglio',
  Oracolo: 'Lupo che vede il ruolo esatto del bersaglio',
  Villico: 'Nessun potere speciale',
};

const WOLF_ROLES = ['Lupo'];

export default function GamePage() {
  const { gameId } = useParams();
  const { state: gs, error } = useGameState(gameId);
  const { refresh } = useAuth();
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState('');
  const [kamikazeMode, setKamikazeMode] = useState(false);
  const [actionSent, setActionSent] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [inspectionResult, setInspectionResult] = useState(null); // {playerId, isWolf}
  const [guesses, setGuesses] = useState({}); // {playerId: role}
  const hasRefreshed = useRef(false);
  const lastNight = useRef(0);

  // Reset inspection & actionSent each new night, reset on DAY
  useEffect(() => {
    if (gs?.state === 'DAY' || gs?.state === 'ROLE_REVEAL') {
      setInspectionResult(null);
      setActionSent(false);
    }
    if (gs?.state === 'NIGHT' && gs?.turn_number !== lastNight.current) {
      lastNight.current = gs.turn_number;
      setInspectionResult(null);
      setActionSent(false);
      setSelectedId(null);
    }
  }, [gs?.state, gs?.turn_number]);

  // Refresh user when game ends (only once)
  useEffect(() => {
    if (gs?.state === 'GAME_OVER' && !hasRefreshed.current) {
      hasRefreshed.current = true;
      refresh();
    }
  }, [gs?.state, refresh]);

  if (!gs) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-32">
          <span className="text-5xl animate-pulse mb-4">🐺</span>
          <p className="text-[var(--text-dim)]">Connessione...</p>
          {error && <p className="text-[var(--accent)] text-sm mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  const { state, me, players, turn_number, timer_seconds_left, roles_in_game, events } = gs;
  const myRole = me?.role;
  const isWolf = myRole === 'Lupo';
  const allPlayers = players || [];

  // Non-players can only view LOBBY
  if (!me && state !== 'LOBBY') {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-32">
          <span className="text-5xl mb-4">🚫</span>
          <p className="text-xl font-bold mb-2">Non sei in questa partita</p>
          <p className="text-[var(--text-dim)] text-sm mb-4">La partita è già iniziata</p>
          <Link to="/" className="text-[var(--accent)] text-sm hover:underline no-underline">
            ← Torna alla Home
          </Link>
        </div>
      </div>
    );
  }

  // ── Toast helper ──
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  // ── Roles in game badge ──
  const RolesList = ({ lightMode = false }) => (
    <div className={`rounded-xl border p-4 ${
      lightMode 
        ? 'bg-blue-50 border-blue-200' 
        : 'bg-[var(--bg-card)] border-[var(--border)]'
    }`}>
      <h4 className={`text-xs font-semibold mb-2 ${
        lightMode ? 'text-blue-900' : 'text-[var(--text-dim)]'
      }`}>Ruoli nella partita</h4>
      <div className="flex flex-wrap gap-2">
        {Object.entries(roles_in_game || {}).map(([role, count]) => (
          <span key={role} className={`text-xs px-2.5 py-1 rounded-lg border ${
            lightMode 
              ? 'bg-white border-blue-300 text-gray-900'
              : 'bg-[var(--bg-elevated)] border-[var(--border)] text-white'
          }`}>
            {ROLE_EMOJI[role] || '❓'} {role} ×{count}
          </span>
        ))}
      </div>
    </div>
  );

  // ════════════════════════════════════════
  //  LOBBY
  // ════════════════════════════════════════
  if (state === 'LOBBY') {
    const isInGame = me !== null && me !== undefined;
    const canJoin = !isInGame && players.length < gs.target_players;

    const handleJoin = async () => {
      try {
        await api.joinGame(gameId);
        showToast('Ti sei unito alla partita!');
      } catch (e) {
        showToast(`Errore: ${e.message}`);
      }
    };

    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-lg mx-auto px-4 py-10">
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6">
            <h2 className="text-2xl font-bold text-center mb-2">Sala d'attesa</h2>
            <p className="text-[var(--text-dim)] text-center text-sm mb-6">
              {isInGame ? 'In attesa dei giocatori...' : 'Partita in preparazione'}
            </p>

            <div className="bg-[var(--bg-elevated)] rounded-xl p-4 text-center mb-6">
              <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Codice Partita</p>
              <p className="text-3xl font-mono font-bold text-[var(--accent)] tracking-[0.3em] select-all">{gs.game_id}</p>
            </div>

            {!isInGame && canJoin && (
              <button onClick={handleJoin}
                className="w-full mb-4 px-6 py-3 bg-[var(--accent)] text-white rounded-xl font-semibold hover:opacity-90 transition cursor-pointer border-none text-base">
                Unisciti alla partita
              </button>
            )}

            {!isInGame && !canJoin && (
              <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-center">
                <p className="text-sm text-red-400">Partita piena</p>
              </div>
            )}

            <div className="flex justify-between items-center mb-4 px-1">
              <span className="text-[var(--text-dim)] text-sm">Giocatori</span>
              <span className="text-xl font-bold">{players.length} / {gs.target_players}</span>
            </div>

            <div className="space-y-1.5 mb-6">
              {players.map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-[var(--bg-dark)] rounded-xl px-4 py-2.5">
                  <span className="text-base">🎭</span>
                  <span className="text-sm font-medium">{p.nickname}</span>
                  {p.id === me?.id && <span className="text-[10px] text-[var(--green)] ml-auto">(Tu)</span>}
                </div>
              ))}
            </div>

            <div className="w-full bg-[var(--bg-dark)] rounded-full h-2 mb-2">
              <div className="bg-[var(--accent)] h-2 rounded-full transition-all duration-500"
                style={{ width: `${(players.length / gs.target_players) * 100}%` }} />
            </div>
            <p className="text-[10px] text-[var(--text-dim)] text-center">
              Il gioco parte automaticamente quando tutti i giocatori sono connessi
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════
  //  ROLE REVEAL
  // ════════════════════════════════════════
  if (state === 'ROLE_REVEAL') {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-lg mx-auto px-4 py-10">
          <div className="text-center mb-6">
            <Timer secondsLeft={timer_seconds_left} />
            <p className="text-[var(--text-dim)] text-sm mt-2">Fase di rivelazione ruoli</p>
          </div>

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-8 text-center">
            {!revealed ? (
              <>
                <div className="w-32 h-44 mx-auto bg-gradient-to-b from-[var(--accent)]/20 to-[var(--bg-elevated)] rounded-2xl border-2 border-[var(--accent)]/30 flex items-center justify-center mb-6 cursor-pointer hover:scale-105 transition-all shadow-lg shadow-[var(--accent)]/10"
                  onClick={() => setRevealed(true)}>
                  <span className="text-5xl">❓</span>
                </div>
                <button onClick={() => setRevealed(true)}
                  className="px-8 py-3 bg-[var(--accent)] text-white rounded-xl font-semibold hover:opacity-90 transition cursor-pointer border-none text-sm">
                  Svela Ruolo
                </button>
              </>
            ) : (
              <>
                <div className="w-32 h-44 mx-auto bg-gradient-to-b from-[var(--accent)]/30 to-[var(--bg-elevated)] rounded-2xl border-2 border-[var(--accent)] flex flex-col items-center justify-center mb-6 shadow-xl shadow-[var(--accent)]/20">
                  <span className="text-5xl mb-2">{ROLE_EMOJI[myRole] || '❓'}</span>
                  <span className="text-sm font-bold">{myRole}</span>
                </div>
                <p className="text-sm text-[var(--text-dim)] mb-2">
                  {ROLE_DESC[myRole] || ''}
                </p>
                {isWolf && (
                  <p className="text-xs text-[var(--accent)] mt-2 font-semibold">
                    🐺 Fai parte della fazione dei Lupi
                    {gs.wolf_teammates?.length > 0 && `: ${gs.wolf_teammates.join(', ')}`}
                  </p>
                )}
                {myRole === 'Kamikaze' && (
                  <p className="text-xs text-[var(--accent)] mt-2 font-semibold">
                    💣 Vinci con i Lupi (ma non li vedi)
                  </p>
                )}
                <button onClick={() => setRevealed(false)}
                  className="mt-4 px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-dim)] rounded-lg text-xs hover:border-[var(--accent)] transition cursor-pointer">
                  🔄 Nascondi ruolo
                </button>
              </>
            )}
          </div>

          <div className="mt-6">
            <RolesList />
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════
  //  NIGHT
  // ════════════════════════════════════════
  if (state === 'NIGHT') {
    const wolfVotes = gs.wolf_votes || {};
    const voteCounts = {};
    Object.values(wolfVotes).forEach(t => { voteCounts[t] = (voteCounts[t] || 0) + 1; });

    const handleNightAction = async (player) => {
      // Veggente/Oracolo can only inspect once per night
      if ((myRole === 'Veggente' || myRole === 'Oracolo') && actionSent) {
        return;
      }

      setSelectedId(player.id);

      let actionType;
      if (myRole === 'Lupo') actionType = 'KILL';
      else if (myRole === 'Veggente') actionType = 'INSPECT';
      else if (myRole === 'Oracolo') actionType = 'INSPECT_ROLE';
      else if (myRole === 'Protettore') actionType = 'PROTECT';
      else if (myRole === 'Mitomane') actionType = 'COPY';
      else if (myRole === 'Kamikaze') actionType = kamikazeMode ? 'EXPLODE' : 'KILL';
      else return;

      try {
        const res = await api.submitAction(gameId, player.id, actionType);
        setActionSent(true);
        
        // Store inspection result for Veggente
        if (myRole === 'Veggente' && res.result) {
          const isWolf = res.result.includes('è un LUPO');
          setInspectionResult({ playerId: player.id, isWolf });
          showToast(res.result);
        } else if (myRole === 'Oracolo' && res.result) {
          setInspectionResult({ playerId: player.id, role: res.result });
          showToast(res.result);
        } else if (res.result) {
          showToast(res.result);
        } else {
          showToast(`Hai scelto ${player.nickname}`);
        }
      } catch (e) {
        showToast(`Errore: ${e.message}`);
      }
    };

    const canAct = me.is_alive && (
      myRole === 'Lupo' || myRole === 'Veggente' || myRole === 'Oracolo' ||
      myRole === 'Protettore' ||
      (myRole === 'Kamikaze' && kamikazeMode) ||
      (myRole === 'Mitomane' && turn_number === 2)
    );

    const getInstruction = () => {
      if (!me.is_alive) return '💀 Sei morto. Osservi in silenzio.';
      switch (myRole) {
        case 'Lupo': return '🐺 Scegli chi uccidere. Gli altri lupi vedono i tuoi voti.';
        case 'Veggente': 
          return actionSent 
            ? '🔮 Hai già ispezionato questa notte. Attendi l\'alba...' 
            : '🔮 Scegli un giocatore per scoprire se è un Lupo.';
        case 'Oracolo': 
          return actionSent
            ? '🔮 Hai già ispezionato questa notte. Attendi l\'alba...'
            : '🔮 Scegli un giocatore per scoprire il suo ruolo esatto.';
        case 'Protettore': return '🛡️ Scegli un giocatore da proteggere (non te stesso).';
        case 'Kamikaze':
          return kamikazeMode
            ? '💥 MODALITÀ ESPLOSIONE – Clicca un giocatore per esplodere con lui!'
            : '💣 Attiva l\'esplosione sotto per selezionare (una volta per partita).';
        case 'Mitomane':
          return turn_number === 2
            ? '🎭 Scegli un giocatore per copiare il suo ruolo!'
            : '🎭 Il tuo potere si attiva solo nella Notte 2. Attendi...';
        case 'Medium':
          return gs.night_message || '👻 Attendi l\'alba...';
        case 'Massone':
          return gs.night_message || '🤝 Attendi l\'alba...';
        default:
          return '🌙 Attendi l\'alba...';
      }
    };

    return (
      <div className="min-h-screen flex flex-col bg-[#0a0e1a]">
        <Navbar />

        {/* Toast */}
        {toast && (
          <div className="fixed top-20 right-4 z-50 bg-[var(--bg-card)] border border-[var(--accent)] rounded-xl px-5 py-3 shadow-2xl max-w-xs animate-bounce">
            <p className="text-sm">{toast}</p>
          </div>
        )}

        {/* Header */}
        <div className="bg-[var(--bg-card)] border-b border-[var(--border)] px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🌙</span>
              <div>
                <h2 className="text-lg font-bold">Notte {turn_number}</h2>
                <p className="text-xs text-[var(--text-dim)]">
                  {ROLE_EMOJI[myRole]} {myRole}
                </p>
              </div>
            </div>
            <Timer secondsLeft={timer_seconds_left} />
          </div>
        </div>

        {/* Instruction */}
        {!me.is_alive ? (
          <div className="bg-red-900/40 border-red-600 border-4 px-6 py-6">
            <p className="max-w-4xl mx-auto text-3xl text-center font-black text-red-400 animate-pulse">💀 SEI MORTO 💀</p>
            <p className="max-w-4xl mx-auto text-sm text-center text-red-300 mt-2">Osservi la partita in silenzio...</p>
          </div>
        ) : (
          <div className="bg-[var(--accent)]/10 border-[var(--accent)]/20 border-2 px-6 py-4">
            <p className="max-w-4xl mx-auto text-base text-center font-bold text-white">{getInstruction()}</p>
            {canAct && <p className="max-w-4xl mx-auto text-xs text-center text-[var(--text-dim)] mt-1">👆 Clicca su un giocatore per selezionarlo</p>}
          </div>
        )}

        {/* Kamikaze toggle */}
        {myRole === 'Kamikaze' && me.is_alive && !me.attributes?.kamikaze_used && (
          <div className="px-6 py-2 bg-[var(--bg-card)] border-b border-[var(--border)]">
            <div className="max-w-4xl mx-auto flex justify-center">
              <button onClick={() => setKamikazeMode(!kamikazeMode)}
                className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border-none
                ${kamikazeMode
                    ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-dim)] border border-[var(--border)]'}`}>
                {kamikazeMode ? '💥 Esplosione ATTIVA' : '� Esplosione disattivata'}
              </button>
            </div>
          </div>
        )}

        {/* Wolf votes & Recent Events */}
        {isWolf && Object.keys(wolfVotes).length > 0 && (
          <div className="bg-[var(--accent)]/5 px-6 py-2 border-b border-[var(--accent)]/10">
            <div className="max-w-4xl mx-auto flex flex-wrap gap-3 justify-center text-xs">
              {Object.entries(wolfVotes).map(([wolf, target]) => (
                <span key={wolf} className="text-[var(--accent)]">🐺 {wolf} → {target}</span>
              ))}
            </div>
          </div>
        )}
        {events && events.length > 0 && (
          <div className="bg-[var(--bg-card)]/30 px-6 py-3 border-b border-[var(--border)]">
            <div className="max-w-4xl mx-auto">
              <p className="text-xs text-[var(--text-dim)] font-bold uppercase mb-2">📜 Eventi della partita</p>
              <div className="flex flex-col gap-1.5">
                {events.slice(-5).map((ev, i) => (
                  <p key={i} className="text-xs text-gray-300 bg-[var(--bg-elevated)] rounded px-2 py-1">
                    {ev.phase === 'NIGHT' ? '🌙' : ev.phase === 'DAY' ? '☀️' : '🏁'} <span className="font-semibold">T{ev.turn}</span> - {ev.detail}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Player grid */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-w-3xl">
            {allPlayers.map(p => {
              let badge = null;
              let badgeColor = null;
              if (isWolf && voteCounts[p.nickname]) {
                badge = `${voteCounts[p.nickname]}🐺`;
              } else if (inspectionResult && inspectionResult.playerId === p.id) {
                if (myRole === 'Veggente') {
                  badge = inspectionResult.isWolf ? '🐺 LUPO' : '✅ Innocente';
                  badgeColor = inspectionResult.isWolf ? 'wolf' : 'safe';
                } else if (myRole === 'Oracolo') {
                  badge = inspectionResult.role || '❓';
                  badgeColor = 'info';
                }
              }
              
              return (
                <PlayerCard key={p.id} player={p}
                  selected={selectedId === p.id}
                  onClick={canAct && p.id !== me?.id ? () => handleNightAction(p) : undefined}
                  isMe={p.id === me?.id}
                  badge={badge}
                  badgeColor={badgeColor} />
              );
            })}
          </div>
        </div>

        {/* Roles list */}
        <div className="px-6 pb-4">
          <div className="max-w-4xl mx-auto"><RolesList /></div>
        </div>

        {/* Night mini-game for idle roles */}
        {me.is_alive && ['Villico', 'Indemoniato', 'Massone'].includes(myRole) && (turn_number > 1 || myRole !== 'Massone') && (
          <div className="px-6 py-4 bg-[var(--bg-card)] border-t border-[var(--border)]">
            <div className="max-w-2xl mx-auto">
              <p className="text-xs font-bold text-[var(--text-dim)] uppercase mb-3">🎯 Mini-gioco: Indovina i ruoli!</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allPlayers.filter(p => p.id !== me?.id && p.is_alive).map(p => (
                  <div key={p.id} className="bg-[var(--bg-elevated)] rounded-lg p-2">
                    <p className="text-xs font-medium mb-1 truncate">{p.nickname}</p>
                    <select
                      value={guesses[p.id] || ''}
                      onChange={(e) => {
                        setGuesses(prev => ({...prev, [p.id]: e.target.value}));
                        api.submitGuess(gameId, p.id, e.target.value).catch(() => {});
                      }}
                      className="w-full text-[10px] bg-[var(--bg-dark)] border border-[var(--border)] rounded px-1 py-1 text-white">
                      <option value="">-- Ruolo? --</option>
                      {Object.entries(roles_in_game || {}).map(([role]) => (
                        <option key={role} value={role}>{ROLE_EMOJI[role] || '❓'} {role}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="bg-[var(--bg-card)] border-t border-[var(--border)] px-6 py-3 text-center">
          {actionSent
            ? <p className="text-[var(--green)] text-xs font-medium">✅ Azione inviata – puoi cambiarla</p>
            : canAct
              ? <p className="text-[var(--text-dim)] text-xs">Seleziona un giocatore</p>
              : <p className="text-[var(--text-dim)] text-xs">Attendi la fine della notte</p>
          }
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════
  //  DAY
  // ════════════════════════════════════════
  if (state === 'DAY') {
    const nightDeaths = gs.night_deaths || [];
    const dayVotes = gs.day_votes || {};
    const voteCounts = {};
    Object.values(dayVotes).forEach(t => { voteCounts[t] = (voteCounts[t] || 0) + 1; });

    const handleVote = async (player) => {
      setSelectedId(player.id);
      try {
        await api.submitVote(gameId, player.id);
        setActionSent(true);
        showToast(`Voto: ${player.nickname} al rogo 🔥`);
      } catch (e) { showToast(`Errore: ${e.message}`); }
    };

    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-amber-50">
        <Navbar />

        {toast && (
          <div className="fixed top-20 right-4 z-50 bg-[var(--bg-card)] border border-[var(--accent)] rounded-xl px-5 py-3 shadow-2xl max-w-xs animate-bounce">
            <p className="text-sm">{toast}</p>
          </div>
        )}

        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">☀️</span>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Giorno {turn_number}</h2>
                <p className="text-xs text-gray-600">Votazione al rogo</p>
              </div>
            </div>
            <div className="text-gray-900">
              <Timer secondsLeft={timer_seconds_left} />
            </div>
          </div>
        </div>

        {/* Night deaths */}
        {nightDeaths.length > 0 ? (
          <div className="bg-red-100 border-b border-red-200 px-6 py-4">
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-base font-semibold text-red-700">
                💀 Stanotte {nightDeaths.length === 1 ? 'è morto' : 'sono morti'}:
              </p>
              <p className="text-lg font-bold mt-1 text-red-900">{nightDeaths.join(', ')}</p>
            </div>
          </div>
        ) : (
          <div className="bg-green-100 border-b border-green-200 px-6 py-3">
            <p className="text-center text-green-700 text-sm font-medium">✨ Nessuno è morto stanotte!</p>
          </div>
        )}

        {/* Instructions */}
        {!me.is_alive ? (
          <div className="bg-red-900/80 border-red-600 border-4 px-6 py-6">
            <p className="max-w-4xl mx-auto text-3xl text-center font-black text-white drop-shadow-lg">💀 SEI MORTO 💀</p>
            <p className="max-w-4xl mx-auto text-sm text-center text-white mt-2">Osservi la partita in silenzio...</p>
          </div>
        ) : (
          <div className="bg-amber-100 border-2 border-amber-300 px-6 py-4">
            <p className="max-w-4xl mx-auto text-base text-center font-bold text-amber-900">
              🔥 Vota chi mandare al rogo
            </p>
            <p className="max-w-4xl mx-auto text-xs text-center text-amber-700 mt-1">
              In caso di parità, tutti i pareggiati muoiono. 👆 Clicca su un giocatore per votarlo.
            </p>
          </div>
        )}

        {/* Recent events */}
        {events && events.length > 0 && (
          <div className="bg-amber-50 border-b-2 border-amber-200 px-6 py-3">
            <div className="max-w-4xl mx-auto">
              <p className="text-xs text-amber-800 font-bold uppercase mb-2">📜 Eventi della partita</p>
              <div className="flex flex-col gap-1.5">
                {events.slice(-5).map((ev, i) => (
                  <p key={i} className="text-xs text-gray-700 bg-white/60 rounded px-2 py-1">
                    {ev.phase === 'NIGHT' ? '🌙' : ev.phase === 'DAY' ? '☀️' : '🏁'} <span className="font-semibold">T{ev.turn}</span> - {ev.detail}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Player grid */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-w-3xl">
            {(() => {
              const maxVotes = Math.max(0, ...Object.values(voteCounts));
              return allPlayers.map(p => {
                const votes = voteCounts[p.nickname] || 0;
                let badgeColor = null;
                if (votes > 0 && votes === maxVotes) badgeColor = 'danger';
                else if (votes > 0) badgeColor = 'warning';
                return (
                  <PlayerCard key={p.id} player={p}
                    selected={selectedId === p.id}
                    onClick={me.is_alive && p.id !== me?.id ? () => handleVote(p) : undefined}
                    isMe={p.id === me?.id}
                    badge={votes > 0 ? `${votes}🔥` : null}
                    badgeColor={badgeColor}
                    lightMode={true} />
                );
              });
            })()}
          </div>
        </div>

        <div className="px-6 pb-4">
          <div className="max-w-4xl mx-auto"><RolesList lightMode={true} /></div>
        </div>

        <div className="bg-white/80 border-t border-gray-200 px-6 py-3 text-center">
          {!me.is_alive
            ? <p className="text-gray-600 text-xs">💀 Sei morto – stai osservando</p>
            : actionSent
              ? <p className="text-green-700 text-xs font-medium">✅ Voto inviato – puoi cambiarlo</p>
              : <p className="text-gray-600 text-xs">Seleziona un giocatore</p>
          }
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════
  //  GAME OVER
  // ════════════════════════════════════════
  if (state === 'GAME_OVER') {
    const allRoles = gs.all_roles || [];
    const events = gs.events || [];
    const teamStyle = {
      Lupi: { emoji: '🐺', color: 'var(--accent)', bg: 'var(--accent)' },
      Villaggio: { emoji: '🏘️', color: 'var(--green)', bg: 'var(--green)' },
      'Criceto Mannaro': { emoji: '🐹', color: 'var(--gold)', bg: 'var(--gold)' },
    };
    const team = teamStyle[gs.winners] || teamStyle.Villaggio;

    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-10">
          {/* Winner */}
          <div className="text-center mb-10">
            <span className="text-7xl block mb-3">{team.emoji}</span>
            <h1 className="text-3xl font-bold mb-1" style={{ color: team.color }}>
              {gs.winners === 'Lupi' ? 'I Lupi Vincono!' : gs.winners === 'Villaggio' ? 'Il Villaggio Vince!' : 'Il Criceto Mannaro Vince!'}
            </h1>
            {gs.winner_detail && <p className="text-sm text-[var(--text-dim)]">{gs.winner_detail}</p>}
          </div>

          {/* Guess leaderboard */}
          {gs.guess_leaderboard && gs.guess_leaderboard.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 mb-6">
              <h3 className="text-base font-bold mb-4 text-center">🎯 Classifica Indovini</h3>
              <div className="space-y-2">
                {gs.guess_leaderboard.map((g, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[var(--bg-elevated)] rounded-xl px-4 py-2.5 border border-[var(--border)]">
                    <span className="text-lg font-bold text-[var(--accent)]">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                    </span>
                    <span className="text-sm font-medium flex-1">{g.nickname}</span>
                    <span className="text-sm font-bold text-[var(--green)]">{g.correct}/{g.total}</span>
                    <span className="text-[10px] text-[var(--text-dim)]">
                      {g.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roles reveal */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 mb-6">
            <h3 className="text-base font-bold mb-4 text-center">Ruoli Rivelati</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allRoles.map((p, i) => (
                <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border
                  ${p.is_alive ? 'bg-[var(--bg-elevated)] border-[var(--border)]' : 'bg-gray-900/30 border-gray-800 opacity-50'}`}>
                  <span className="text-lg">{ROLE_EMOJI[p.role] || '❓'}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{p.nickname}</p>
                    <p className={`text-[10px] ${WOLF_ROLES.includes(p.role) ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'}`}>
                      {p.role}
                      {p.final_role && p.final_role !== p.role && ` → ${p.final_role}`}
                    </p>
                  </div>
                  {!p.is_alive && <span className="ml-auto text-xs">💀</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Events log */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 mb-6">
            <h3 className="text-base font-bold mb-4 text-center">📜 Cronologia</h3>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {events.map((ev, i) => (
                <div key={i} className="text-xs text-[var(--text-dim)] bg-[var(--bg-dark)] rounded-lg px-3 py-2">
                  <span className="text-[var(--text-dim)] font-mono mr-2">
                    {ev.phase === 'NIGHT' ? '🌙' : ev.phase === 'DAY' ? '☀️' : '🏁'}
                    T{ev.turn}
                  </span>
                  {ev.detail}
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Link to="/"
              className="inline-block px-8 py-3 bg-[var(--accent)] text-white rounded-xl font-semibold hover:opacity-90 transition no-underline text-sm">
              🏠 Torna alla Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <p className="text-center pt-20 text-[var(--text-dim)]">Stato sconosciuto: {state}</p>
    </div>
  );
}
