import { sanitizeHtml } from '../content/sanitize';

interface ExplanationPanelProps {
  isCorrect: boolean;
  correctAnswerText: string;
  explanationHtml: string;
}

export default function ExplanationPanel({ isCorrect, correctAnswerText, explanationHtml }: ExplanationPanelProps) {
  return (
    <div
      className={`rounded-2xl border p-4 ${isCorrect ? 'border-good/30 bg-good/5' : 'border-bad/30 bg-bad/5'}`}
      data-testid="explanation-panel"
      data-correct={isCorrect}
    >
      {/* "Not quite — Cannon a waves" read as though the correct answer were the
          wrong one. Name what the answer *is* on the miss path. */}
      <p className={`text-sm font-semibold ${isCorrect ? 'text-good' : 'text-bad'}`}>
        {isCorrect ? `Correct — ${correctAnswerText}` : `Not quite. The answer is ${correctAnswerText}`}
      </p>
      <div
        className="prose-content mt-2 text-sm text-ink"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(explanationHtml) }}
      />
    </div>
  );
}
