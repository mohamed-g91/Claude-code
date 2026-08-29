import { sanitizeHtml } from '../content/sanitize';

interface QuestionCardProps {
  stem: string;
  vignetteHtml: string | null;
  incomplete: boolean;
}

export default function QuestionCard({ stem, vignetteHtml, incomplete }: QuestionCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface-alt p-4 shadow-card" data-testid="question-card">
      {!incomplete && vignetteHtml && (
        <div
          className="prose-content mb-3 text-sm text-ink"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(vignetteHtml) }}
        />
      )}
      <p className="text-base font-medium">{stem}</p>
    </div>
  );
}
