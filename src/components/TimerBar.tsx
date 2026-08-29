import { useEffect, useRef, useState } from 'react';

interface TimerBarProps {
  durationMs: number;
  runningKey: string | number; // change this to restart the timer
  onExpire: () => void;
}

/** A depleting bar used by time-pressured modes (Rapid Fire). */
export default function TimerBar({ durationMs, runningKey, onExpire }: TimerBarProps) {
  const [remaining, setRemaining] = useState(1);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const start = performance.now();
    let raf: number;

    const tick = () => {
      const elapsed = performance.now() - start;
      const frac = Math.max(0, 1 - elapsed / durationMs);
      setRemaining(frac);
      if (frac <= 0) {
        onExpireRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs, runningKey]);

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border" data-testid="timer-bar">
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${remaining * 100}%`, transition: remaining === 1 ? 'none' : 'width 100ms linear' }}
      />
    </div>
  );
}
