import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './useAuth.jsx';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import GamePage from './pages/GamePage';
import History from './pages/History';
import Rules from './pages/Rules';

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-5xl animate-pulse">🐺</span>
      </div>
    );
  }
  if (user === null) return <Navigate to="/login" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-5xl animate-pulse">🐺</span>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/game/:gameId" element={<RequireAuth><GamePage /></RequireAuth>} />
      <Route path="/regole" element={<RequireAuth><Rules /></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
      <Route path="/history/:gameId" element={<RequireAuth><History /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
