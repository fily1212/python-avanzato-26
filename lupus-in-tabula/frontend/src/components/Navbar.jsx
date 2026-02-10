import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="bg-[var(--bg-card)] border-b border-[var(--border)] px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold hover:text-[var(--accent)] transition no-underline text-[var(--text)]">
          🐺 Lupus in Tabula
        </Link>
        <div className="flex items-center gap-4">
          {user.current_game && (
            <Link to={`/game/${user.current_game}`}
              className="text-sm bg-[var(--accent)] px-3 py-1 rounded-lg hover:opacity-90 transition no-underline text-white">
              Partita in corso
            </Link>
          )}
          <Link to="/regole" className="text-sm text-white hover:text-[var(--accent)] transition no-underline">
            Regole
          </Link>
          <Link to="/history" className="text-sm text-white hover:text-[var(--accent)] transition no-underline">
            Storico
          </Link>
          <span className="text-sm text-white font-medium">
            {user.username}
          </span>
          <button onClick={handleLogout}
            className="text-xs text-white hover:text-[var(--accent)] transition bg-transparent border-none cursor-pointer">
            Esci
          </button>
        </div>
      </div>
    </nav>
  );
}
