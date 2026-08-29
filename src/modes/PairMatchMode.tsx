import { useMemo, useState } from 'react';
import SessionShell from '../components/SessionShell';
import { useAnswerEngine } from '../app/useAnswerEngine';
import type { ContentBundle } from '../content/loader';
import type { StorageProvider } from '../storage/provider';

interface PairMatchModeProps {
  bundle: ContentBundle;
  storage: StorageProvider;
}

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function PairMatchMode({ bundle, storage }: PairMatchModeProps) {
  const rounds = bundle.playItems.modes.pairMatch;
  const [roundIndex, setRoundIndex] = useState(0);
  const round = rounds[roundIndex];
  const { submitAnswer } = useAnswerEngine(storage);

  const rightOrder = useMemo(() => (round ? shuffle(round.pairs.map((p) => p.questionId)) : []), [round]);

  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [leftSelected, setLeftSelected] = useState<string | null>(null);
  const [wrongAttempt, setWrongAttempt] = useState<{ left: string; right: string } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [combo, setCombo] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [roundComplete, setRoundComplete] = useState(false);

  if (!round) {
    return (
      <SessionShell title="Pair Match" current={0} total={0} combo={0} xpEarned={0}>
        <p className="text-sm text-ink-muted">Not enough questions to build a Pair Match round yet.</p>
      </SessionShell>
    );
  }

  function selectLeft(questionId: string) {
    if (matched.has(questionId)) return;
    setLeftSelected((current) => (current === questionId ? null : questionId));
    setWrongAttempt(null);
  }

  async function selectRight(rightQuestionId: string) {
    if (!leftSelected || matched.has(rightQuestionId)) return;
    const isCorrect = leftSelected === rightQuestionId;
    const pair = round.pairs.find((p) => p.questionId === leftSelected)!;
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    const result = await submitAnswer({ questionId: pair.questionId, group: pair.group, mode: 'pairMatch', isCorrect });
    setCombo(result.newProfile.score.combo);
    setXpEarned(result.newProfile.score.xp);

    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      setMatched((prev) => {
        const next = new Set(prev);
        next.add(leftSelected);
        if (next.size >= round.pairs.length) setRoundComplete(true);
        return next;
      });
      setLeftSelected(null);
      setWrongAttempt(null);
    } else {
      setWrongAttempt({ left: leftSelected, right: rightQuestionId });
      setTimeout(() => setWrongAttempt(null), 500);
    }
  }

  function nextRound() {
    setMatched(new Set());
    setLeftSelected(null);
    setWrongAttempt(null);
    setAttempts(0);
    setCorrectCount(0);
    setRoundComplete(false);
    setRoundIndex((i) => (i + 1) % rounds.length);
  }

  return (
    <SessionShell
      title="Pair Match"
      current={matched.size}
      total={round.pairs.length}
      combo={combo}
      xpEarned={xpEarned}
      complete={roundComplete}
      correctCount={correctCount}
      onExit={roundComplete ? nextRound : undefined}
    >
      <p className="mb-3 text-sm text-ink-muted">Tap a vignette, then tap its matching answer.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          {round.pairs.map((pair) => (
            <button
              key={pair.questionId}
              type="button"
              disabled={matched.has(pair.questionId)}
              onClick={() => selectLeft(pair.questionId)}
              data-testid={`pair-left-${pair.questionId}`}
              className={`min-h-touch rounded-xl border p-3 text-left text-xs ${
                matched.has(pair.questionId)
                  ? 'border-good bg-good/10 opacity-60'
                  : leftSelected === pair.questionId
                    ? 'border-accent bg-accent/10'
                    : wrongAttempt?.left === pair.questionId
                      ? 'border-bad bg-bad/10'
                      : 'border-border bg-surface-alt'
              }`}
            >
              {pair.leftText}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {rightOrder.map((questionId) => {
            const pair = round.pairs.find((p) => p.questionId === questionId)!;
            return (
              <button
                key={questionId}
                type="button"
                disabled={matched.has(questionId)}
                onClick={() => void selectRight(questionId)}
                data-testid={`pair-right-${questionId}`}
                className={`min-h-touch rounded-xl border p-3 text-left text-xs font-medium ${
                  matched.has(questionId)
                    ? 'border-good bg-good/10 opacity-60'
                    : wrongAttempt?.right === questionId
                      ? 'border-bad bg-bad/10'
                      : 'border-border bg-surface-alt'
                }`}
              >
                {pair.rightText}
              </button>
            );
          })}
        </div>
      </div>
    </SessionShell>
  );
}
