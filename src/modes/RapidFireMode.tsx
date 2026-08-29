import { useEffect, useMemo, useState } from 'react';
import SessionShell from '../components/SessionShell';
import QuestionCard from '../components/QuestionCard';
import OptionButton from '../components/OptionButton';
import TimerBar from '../components/TimerBar';
import { useAnswerEngine } from '../app/useAnswerEngine';
import { selectWeightedRandom, type SrsEntry } from '../domain/selectors';
import { createInitialCardState } from '../domain/srs';
import type { ContentBundle } from '../content/loader';
import type { StorageProvider } from '../storage/provider';
import type { AnswerKey } from '../content/types';

interface RapidFireModeProps {
  bundle: ContentBundle;
  storage: StorageProvider;
}

const SESSION_LENGTH = 15;
const TIME_PER_QUESTION_MS = 12000;

export default function RapidFireMode({ bundle, storage }: RapidFireModeProps) {
  const { submitAnswer } = useAnswerEngine(storage);
  const [entries, setEntries] = useState<SrsEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    storage.getAllCardStates().then((cardStates) => {
      if (cancelled) return;
      const now = new Date();
      const list = bundle.content.questions.map((q) => ({
        question: q,
        cardState: cardStates[q.id] ?? createInitialCardState(now)
      }));
      setEntries(selectWeightedRandom(list, SESSION_LENGTH, Math.random));
    });
    return () => {
      cancelled = true;
    };
  }, [bundle, storage]);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedKey, setSelectedKey] = useState<AnswerKey | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [combo, setCombo] = useState(0);

  const list = useMemo(() => entries ?? [], [entries]);
  const question = list[index]?.question;
  const complete = entries !== null && index >= list.length;

  async function selectOption(key: AnswerKey | null) {
    if (revealed || !question) return;
    setSelectedKey(key);
    setRevealed(true);
    const isCorrect = key === question.correctAnswer;
    const result = await submitAnswer({
      questionId: question.id,
      group: question.group,
      mode: 'rapidFire',
      isCorrect,
      optionKey: key ?? undefined,
      fast: true
    });
    setCorrectCount((c) => c + (isCorrect ? 1 : 0));
    setCombo(result.newProfile.score.combo);
    setXpEarned(result.newProfile.score.xp);

    setTimeout(() => {
      setSelectedKey(null);
      setRevealed(false);
      setIndex((i) => i + 1);
    }, 600);
  }

  if (entries === null) {
    return (
      <SessionShell title="Rapid Fire" current={0} total={0} combo={0} xpEarned={0}>
        <p className="text-sm text-ink-muted">Loading…</p>
      </SessionShell>
    );
  }

  return (
    <SessionShell
      title="Rapid Fire"
      current={index}
      total={list.length}
      combo={combo}
      xpEarned={xpEarned}
      complete={complete}
      correctCount={correctCount}
    >
      {question && (
        <div className="flex flex-col gap-4">
          {!revealed && <TimerBar durationMs={TIME_PER_QUESTION_MS} runningKey={question.id} onExpire={() => void selectOption(null)} />}
          <QuestionCard stem={question.questionStem} vignetteHtml={question.questionHtml} incomplete={question.incomplete} />
          <div className="flex flex-col gap-2">
            {question.options
              .filter((o) => o.text !== '')
              .map((option) => (
                <OptionButton
                  key={option.key}
                  optionKey={option.key}
                  text={option.text}
                  selected={selectedKey === option.key}
                  correct={option.key === question.correctAnswer}
                  revealed={revealed}
                  disabled={revealed}
                  onSelect={() => void selectOption(option.key)}
                />
              ))}
          </div>
        </div>
      )}
    </SessionShell>
  );
}
