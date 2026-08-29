import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import ComboMeter from './ComboMeter';

interface SessionShellProps {
  title: string;
  current: number; // 1-indexed
  total: number;
  combo: number;
  xpEarned: number;
  complete?: boolean;
  correctCount?: number;
  onExit?: () => void;
  children: ReactNode;
}

export default function SessionShell({
  title,
  current,
  total,
  combo,
  xpEarned,
  complete = false,
  correctCount = 0,
  onExit,
  children
}: SessionShellProps) {
  const navigate = useNavigate();
  const progress = total > 0 ? Math.min(1, current / total) : 0;

  const handleExit = () => {
    if (onExit) onExit();
    else navigate('/practice');
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-border bg-surface px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Exit session"
            onClick={handleExit}
            className="flex min-h-touch min-w-touch items-center justify-center text-xl text-ink-muted"
          >
            ×
          </button>
          <p className="text-sm font-medium text-ink-muted">{title}</p>
          <ComboMeter combo={combo} xpEarned={xpEarned} />
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
      </header>

      <div className="flex-1 px-4 py-5">
        {complete ? (
          <div className="flex flex-col items-center gap-4 pt-10 text-center" data-testid="session-summary">
            <p className="text-lg font-semibold">Session complete</p>
            <p className="text-4xl font-bold text-accent">
              {correctCount}/{total}
            </p>
            <p className="text-sm text-ink-muted">+{xpEarned} XP earned</p>
            <button
              type="button"
              className="mt-4 min-h-touch rounded-2xl bg-accent px-6 py-3 font-semibold text-accent-ink"
              onClick={handleExit}
            >
              Done
            </button>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
