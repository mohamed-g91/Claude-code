import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';

interface DropBucketProps {
  id: string;
  label: string;
  children: ReactNode;
  onTapPlace: () => void;
}

export default function DropBucket({ id, label, children, onTapPlace }: DropBucketProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      onClick={onTapPlace}
      data-testid={`bucket-${id}`}
      className={`flex min-h-[5.5rem] flex-col gap-1.5 rounded-2xl border-2 border-dashed p-2 transition-colors ${
        isOver ? 'border-accent bg-accent/5' : 'border-border'
      }`}
    >
      <p className="text-[0.65rem] font-semibold uppercase leading-tight tracking-wide text-ink-muted">{label}</p>
      <div className="flex flex-1 flex-col gap-1.5">{children}</div>
    </div>
  );
}
