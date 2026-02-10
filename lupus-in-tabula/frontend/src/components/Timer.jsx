import { useState, useEffect } from 'react';

export default function Timer({ secondsLeft }) {
  const [localSeconds, setLocalSeconds] = useState(secondsLeft);

  // Sync with server time when it changes
  useEffect(() => {
    setLocalSeconds(secondsLeft);
  }, [secondsLeft]);

  // Local countdown every second
  useEffect(() => {
    const id = setInterval(() => {
      setLocalSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor(localSeconds / 60);
  const secs = localSeconds % 60;
  const urgent = localSeconds <= 30;

  return (
    <div className={`font-mono text-3xl font-bold tracking-wider
      ${urgent ? 'text-[var(--accent)] animate-pulse' : ''}`}>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}
