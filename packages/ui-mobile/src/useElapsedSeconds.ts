import { useEffect, useState } from 'react';

/**
 * Seconds since `startedAt`, ticking while `running`. It counts from the server's start time, not from when the
 * screen opened, so closing and reopening a walk (or the whole app) does not restart the wait.
 */
export function useElapsedSeconds(startedAt: string | Date | null | undefined, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  const start = startedAt ? new Date(startedAt).getTime() : null;

  useEffect(() => {
    if (!running || start === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running, start]);

  if (!running || start === null) return 0;
  return Math.max(0, Math.floor((now - start) / 1000));
}
