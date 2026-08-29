interface OptionButtonProps {
  optionKey: string;
  text: string;
  selected: boolean;
  correct: boolean;
  revealed: boolean;
  disabled: boolean;
  onSelect: () => void;
}

export default function OptionButton({ optionKey, text, selected, correct, revealed, disabled, onSelect }: OptionButtonProps) {
  let stateClasses = 'border-border bg-surface-alt';
  if (revealed && correct) {
    stateClasses = 'border-good bg-good/10';
  } else if (revealed && selected && !correct) {
    stateClasses = 'border-bad bg-bad/10';
  } else if (selected) {
    stateClasses = 'border-accent bg-accent/5';
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      data-testid={`option-${optionKey}`}
      className={`flex min-h-touch w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${stateClasses}`}
    >
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-semibold">
        {optionKey}
      </span>
      <span className="text-sm">{text}</span>
    </button>
  );
}
