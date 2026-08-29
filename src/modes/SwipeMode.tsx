import { useMemo, useRef, useState } from 'react';
import SessionShell from '../components/SessionShell';
import { useAnswerEngine } from '../app/useAnswerEngine';
import type { ContentBundle } from '../content/loader';
import type { StorageProvider } from '../storage/provider';

interface SwipeModeProps {
  bundle: ContentBundle;
  storage: StorageProvider;
}

const SESSION_LENGTH = 15;
const SWIPE_THRESHOLD = 80;

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function SwipeMode({ bundle, storage }: SwipeModeProps) {
  const items = useMemo(() => shuffle(bundle.playItems.modes.swipeSort).slice(0, SESSION_LENGTH), [bundle]);
  const { submitAnswer } = useAnswerEngine(storage);

  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [combo, setCombo] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [lastResult, setLastResult] = useState<'right' | 'wrong' | null>(null);
  const dragging = useRef(false);
  const startX = useRef(0);

  const item = items[index];
  const question = item ? bundle.questionsById.get(item.questionId) : undefined;
  const complete = index >= items.length;

  async function answer(swipeRight: boolean) {
    if (!item || !question) return;
    const isCorrect = swipeRight === item.truth;
    setLastResult(isCorrect ? 'right' : 'wrong');

    const result = await submitAnswer({ questionId: item.questionId, group: item.group, mode: 'swipeSort', isCorrect });
    setCorrectCount((c) => c + (isCorrect ? 1 : 0));
    setCombo(result.newProfile.score.combo);
    setXpEarned(result.newProfile.score.xp);

    setTimeout(() => {
      setDragX(0);
      setLastResult(null);
      setIndex((i) => i + 1);
    }, 220);
  }

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    startX.current = e.clientX;
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    setDragX(e.clientX - startX.current);
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragX > SWIPE_THRESHOLD) {
      void answer(true);
    } else if (dragX < -SWIPE_THRESHOLD) {
      void answer(false);
    } else {
      setDragX(0);
    }
  }

  return (
    <SessionShell
      title="Swipe Sort"
      current={index}
      total={items.length}
      combo={combo}
      xpEarned={xpEarned}
      complete={complete}
      correctCount={correctCount}
    >
      {item && question && (
        <div className="flex flex-col gap-4">
          <p className="text-center text-xs font-medium uppercase tracking-wide text-ink-muted">
            Swipe right if this is the correct management
          </p>
          <div
            data-testid="swipe-card"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
              transition: dragging.current ? 'none' : 'transform 200ms ease'
            }}
            className={`touch-none select-none rounded-2xl border p-5 shadow-card ${
              lastResult === 'right'
                ? 'border-good bg-good/10'
                : lastResult === 'wrong'
                  ? 'border-bad bg-bad/10'
                  : 'border-border bg-surface-alt'
            }`}
          >
            <p className="mb-3 text-sm text-ink-muted">{question.questionStem}</p>
            <p className="text-base font-medium">{item.optionText}</p>
          </div>

          <div className="flex justify-center gap-4">
            <button
              type="button"
              data-testid="swipe-reject"
              onClick={() => void answer(false)}
              className="min-h-touch min-w-touch rounded-full border border-bad px-6 py-3 text-lg font-semibold text-bad"
              aria-label="Not the correct management"
            >
              ✗
            </button>
            <button
              type="button"
              data-testid="swipe-accept"
              onClick={() => void answer(true)}
              className="min-h-touch min-w-touch rounded-full border border-good px-6 py-3 text-lg font-semibold text-good"
              aria-label="This is the correct management"
            >
              ✓
            </button>
          </div>
        </div>
      )}
    </SessionShell>
  );
}
