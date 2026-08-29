import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface DraggableTileProps {
  id: string;
  text: string;
  selected: boolean;
  disabled?: boolean;
  feedback?: 'correct' | 'incorrect' | null;
  onTap: () => void;
}

/** A tile in Bucket Match. Drag it (pointer or keyboard) or tap it, then tap
 * a bucket — the tap fallback exists because drag-and-drop on mobile
 * browsers is unreliable, not as an accessibility afterthought. */
export default function DraggableTile({ id, text, selected, disabled, feedback, onTap }: DraggableTileProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });
  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 20 : undefined
  };

  let tone = 'border-border bg-surface-alt';
  if (feedback === 'correct') tone = 'border-good bg-good/10';
  else if (feedback === 'incorrect') tone = 'border-bad bg-bad/10';
  else if (selected) tone = 'border-accent bg-accent/10';

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onTap}
      disabled={disabled}
      data-testid={`tile-${id}`}
      data-selected={selected}
      className={`min-h-touch touch-none select-none rounded-xl border px-3 py-2 text-left text-sm font-medium shadow-card ${tone} ${
        isDragging ? 'opacity-80' : ''
      } ${disabled ? 'opacity-60' : ''}`}
    >
      {text}
    </button>
  );
}
