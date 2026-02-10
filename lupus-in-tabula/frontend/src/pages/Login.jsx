import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-6xl block mb-3">🐺</span>
          <h1 className="text-3xl font-bold">Lupus in Tabula</h1>
          <p className="text-[var(--text-dim)] mt-1">Accedi per giocare</p>
        </div>

        <form onSubmit={handleSubmit}
          className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border)] shadow-xl space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:border-[var(--accent)] outline-none transition"
              placeholder="Il tuo username" autoFocus />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:border-[var(--accent)] outline-none transition"
              placeholder="••••••••" />
          </div>

          {error && <p className="text-[var(--accent)] text-xs text-center">{error}</p>}

          <button type="submit" disabled={loading || !username || !password}
            className="w-full py-2.5 bg-[var(--accent)] text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-40 cursor-pointer border-none text-sm">
            {loading ? 'Accesso...' : 'Accedi'}
          </button>

          <p className="text-center text-xs text-[var(--text-dim)]">
            Non hai un account?{' '}
            <Link to="/register" className="text-[var(--accent)] hover:underline">Registrati</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
