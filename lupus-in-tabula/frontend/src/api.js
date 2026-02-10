const BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    let msg = 'Errore';
    if (typeof err.detail === 'string') {
      msg = err.detail;
    } else if (Array.isArray(err.detail)) {
      msg = err.detail.map(e => e.msg || JSON.stringify(e)).join('; ');
    }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  register: (username, password) => request('POST', '/register', { username, password }),
  login: (username, password) => request('POST', '/login', { username, password }),
  logout: () => request('POST', '/logout'),
  me: () => request('GET', '/me'),

  createGame: (target_players) => request('POST', '/create_game', { target_players }),
  joinGame: (gameId) => request('POST', `/join_game/${gameId}`),
  listGames: () => request('GET', '/games'),
  gameState: (gameId) => request('GET', `/game_state/${gameId}`),

  submitAction: (gameId, target_id, action_type) =>
    request('POST', `/action/${gameId}`, { target_id, action_type }),
  submitVote: (gameId, target_id) =>
    request('POST', `/vote/${gameId}`, { target_id }),
  submitGuess: (gameId, target_id, guessed_role) =>
    request('POST', `/guess/${gameId}`, { target_id, guessed_role }),

  history: () => request('GET', '/history'),
  gameHistory: (gameId) => request('GET', `/history/${gameId}`),
};
