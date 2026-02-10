import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const ROLES = [
  {
    name: 'Lupo',
    emoji: '🐺',
    team: 'Lupi',
    description: 'Ogni notte vota un giocatore da uccidere insieme agli altri lupi. Vince se i lupi diventano maggioranza o pareggio.',
    powers: ['Voto collettivo notturno', 'Vede gli altri lupi'],
  },
  {
    name: 'Villico',
    emoji: '🏘️',
    team: 'Villaggio',
    description: 'Cittadino normale senza poteri speciali. Deve collaborare con il villaggio per identificare ed eliminare i lupi.',
    powers: ['Nessun potere speciale'],
  },
  {
    name: 'Veggente',
    emoji: '🔮',
    team: 'Villaggio',
    description: 'Ogni notte può ispezionare un giocatore per scoprire se è un Lupo o no (include Lupo, Oracolo, ma NON Kamikaze).',
    powers: ['Ispezione notturna (Lupo/Non Lupo)', 'Una sola ispezione per notte'],
  },
  {
    name: 'Oracolo',
    emoji: '🔮',
    team: 'Lupi',
    description: 'Vince con i Lupi ma NON li vede. Ogni notte può scoprire il ruolo esatto di un giocatore. Se non ispeziona, non può selezionare nessuno e non vede i voti degli altri lupi.',
    powers: ['Ispezione notturna (ruolo esatto)', 'Vince con i lupi', 'NON vede gli altri lupi', 'Una sola ispezione per notte', 'Può selezionare solo quando ispeziona'],
  },
  {
    name: 'Protettore',
    emoji: '🛡️',
    team: 'Villaggio',
    description: 'Ogni notte può proteggere un giocatore (non sé stesso) dalla morte per attacco dei lupi.',
    powers: ['Protezione notturna', 'Non può proteggere sé stesso', 'Può proteggere lo stesso giocatore più notti'],
  },
  {
    name: 'Medium',
    emoji: '👻',
    team: 'Villaggio',
    description: 'Dalla notte 2 in poi, scopre se il giocatore morto al rogo del giorno precedente era un Lupo o no.',
    powers: ['Verità sul morto al rogo', 'Attivo dalla notte 2'],
  },
  {
    name: 'Kamikaze',
    emoji: '💣',
    team: 'Lupi',
    description: 'Vince con i Lupi ma NON li vede. Una volta per partita può attivare l\'esplosione: uccide sé stesso e il giocatore selezionato. Se non attiva l\'esplosione, non può selezionare nessuno di notte e non vede i voti degli altri lupi.',
    powers: ['Esplosione una volta (uccide sé + target)', 'Vince con i lupi', 'NON vede gli altri lupi', 'Può selezionare solo in modalità esplosione'],
  },
  {
    name: 'Mitomane',
    emoji: '🎭',
    team: 'Variabile',
    description: 'Alla notte 2 può copiare il ruolo di un giocatore scelto. Diventa quel ruolo per il resto della partita.',
    powers: ['Copia ruolo alla notte 2', 'Cambia squadra in base al ruolo copiato'],
  },
  {
    name: 'Indemoniato',
    emoji: '😈',
    team: 'Lupi',
    description: 'Umano che vince con i lupi. Non ha poteri speciali e non vede chi sono i lupi.',
    powers: ['Vince con i lupi', 'Non vede gli altri lupi', 'Nessun potere attivo'],
  },
  {
    name: 'Massone',
    emoji: '🤝',
    team: 'Villaggio',
    description: 'I massoni si conoscono tra loro dalla prima notte. Fanno parte del villaggio.',
    powers: ['Si riconoscono tra loro', 'Sanno di potersi fidare reciprocamente'],
  },
  {
    name: 'Criceto Mannaro',
    emoji: '🐹',
    team: 'Neutrale',
    description: 'Giocatore neutrale. Immune agli attacchi notturni dei lupi. Vince da solo se sopravvive alla fine.',
    powers: ['Immune ai lupi', 'Vince da solo', 'Non può essere ucciso di notte'],
  },
];

export default function Rules() {
  return (
    <div className="min-h-screen bg-[var(--bg-dark)]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">📖 Regole e Ruoli</h1>
          <p className="text-[var(--text-dim)]">Scopri i poteri di ogni ruolo e le meccaniche di gioco</p>
        </div>

        {/* Game Flow */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>⚙️</span> Fasi di Gioco
          </h2>
          <div className="space-y-4">
            <div className="bg-[var(--bg-elevated)] rounded-lg p-4">
              <h3 className="font-bold mb-1 text-[var(--accent)]">1. Lobby</h3>
              <p className="text-sm text-[var(--text-dim)]">
                Il creatore invita i giocatori e configura il numero di giocatori obiettivo. Quando tutti sono pronti, il gioco inizia.
              </p>
            </div>
            <div className="bg-[var(--bg-elevated)] rounded-lg p-4">
              <h3 className="font-bold mb-1 text-[var(--accent)]">2. Rivelazione Ruoli (2 minuti)</h3>
              <p className="text-sm text-[var(--text-dim)]">
                Ogni giocatore scopre segretamente il proprio ruolo. I lupi vengono informati su chi sono i loro compagni.
              </p>
            </div>
            <div className="bg-[var(--bg-elevated)] rounded-lg p-4">
              <h3 className="font-bold mb-1 text-purple-400">3. Notte (3 minuti)</h3>
              <p className="text-sm text-[var(--text-dim)]">
                I ruoli con poteri notturni agiscono. I lupi votano chi uccidere. Il Veggente ispeziona. Il Protettore protegge. Ecc.
              </p>
            </div>
            <div className="bg-[var(--bg-elevated)] rounded-lg p-4">
              <h3 className="font-bold mb-1 text-amber-400">4. Giorno (3 minuti)</h3>
              <p className="text-sm text-[var(--text-dim)]">
                Vengono rivelate le morti notturne. Tutti i giocatori vivi votano chi mandare al rogo. In caso di parità, tutti i pareggiati muoiono.
              </p>
            </div>
            <div className="bg-[var(--bg-elevated)] rounded-lg p-4">
              <h3 className="font-bold mb-1 text-[var(--green)]">5. Vittoria</h3>
              <p className="text-sm text-[var(--text-dim)]">
                <strong>Villaggio:</strong> vince se tutti i lupi (Lupo, Oracolo, Kamikaze) muoiono.<br />
                <strong>Lupi:</strong> vincono se diventano maggioranza o pareggio.<br />
                <strong>Criceto:</strong> vince da solo se sopravvive fino alla fine.
              </p>
            </div>
          </div>
        </div>

        {/* Roles */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <span>🎭</span> Ruoli
          </h2>
          <div className="grid gap-4">
            {ROLES.map(role => (
              <div key={role.name} className="bg-[var(--bg-elevated)] rounded-lg p-4 border border-[var(--border)]">
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-3xl">{role.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{role.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        role.team === 'Lupi' 
                          ? 'bg-red-500/20 text-red-400'
                          : role.team === 'Villaggio'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {role.team}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-dim)] mb-3">{role.description}</p>
                    <div className="space-y-1">
                      {role.powers.map((power, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-[var(--accent)] text-xs mt-0.5">▸</span>
                          <span className="text-xs text-[var(--text-dim)]">{power}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-[var(--accent)] text-sm hover:underline no-underline">
            ← Torna alla Home
          </Link>
        </div>
      </div>
    </div>
  );
}
