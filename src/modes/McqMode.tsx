import { useMemo, useState } from 'react';
import SessionShell from '../components/SessionShell';
import QuestionCard from '../components/QuestionCard';
import OptionButton from '../components/OptionButton';
import ExplanationPanel from '../components/ExplanationPanel';
import { useAnswerEngine } from '../app/useAnswerEngine';
import type { ContentBundle } from '../content/loader';
import type { StorageProvider } from '../storage/provider';
import type { Question, AnswerKey } from '../content/types';
import type { PlayMode } from '../domain/scoring';

interface McqModeProps {
  bundle: ContentBundle;
  storage: StorageProvider;
  questions?: Question[];
  title?: string;
  mode?: PlayMode;
  sessionLength?: number;
}

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const DEFAULT_SESSION_LENGTH = 15;

export default function McqMode({ bundle, storage, questions, title = 'MCQ', mode = 'mcq', sessionLength = DEFAULT_SESSION_LENGTH }: McqModeProps) {
  const list = useMemo(() => {
    if (questions) return questions;
    return shuffle(bundle.content.questions).slice(0, sessionLength);
  }, [questions, bundle, sessionLength]);

  const { submitAnswer } = useAnswerEngine(storage);

  const [index, setIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<AnswerKey | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [combo, setCombo] = useState(0);

  const question = list[index];
  const complete = index >= list.length;

  async function selectOption(key: AnswerKey) {
    if (revealed || !question) return;
    setSelectedKey(key);
    setRevealed(true);
    const isCorrect = key === question.correctAnswer;
    const result = await submitAnswer({ questionId: question.id, group: question.group, mode, isCorrect, optionKey: key });
    setCorrectCount((c) => c + (isCorrect ? 1 : 0));
    setCombo(result.newProfile.score.combo);
    setXpEarned(result.newProfile.score.xp);
  }

  function next() {
    setSelectedKey(null);
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  return (
    <SessionShell
      title={title}
      current={index}
      total={list.length}
      combo={combo}
      xpEarned={xpEarned}
      complete={complete}
      correctCount={correctCount}
    >
      {question && (
        <div className="flex flex-col gap-4">
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

          {revealed && (
            <>
              <ExplanationPanel
                isCorrect={selectedKey === question.correctAnswer}
                correctAnswerText={question.correctAnswerText}
                explanationHtml={question.explanationHtml}
              />
              <button
                type="button"
                data-testid="mcq-next"
                onClick={next}
                className="min-h-touch rounded-2xl bg-accent px-6 py-3 font-semibold text-accent-ink"
              >
                {index + 1 >= list.length ? 'Finish' : 'Next'}
              </button>
            </>
          )}
        </div>
      )}
    </SessionShell>
  );
}
