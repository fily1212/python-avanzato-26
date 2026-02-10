import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';

export function useGameState(gameId) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!gameId) return;
    try {
      const data = await api.gameState(gameId);
      setState(data);
      setError(null);
      if (data.state === 'GAME_OVER') {
        stopPolling();
      }
    } catch (e) {
      setError(e.message);
    }
  }, [gameId, stopPolling]);

  useEffect(() => {
    stopPolling();
    if (!gameId) return;
    poll();
    const id = setInterval(poll, 5000);
    intervalRef.current = id;
    return () => stopPolling();
  }, [gameId, poll, stopPolling]);

  return { state, error, refresh: poll };
}
