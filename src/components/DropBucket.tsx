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
      className={`flex min-h-[7rem] flex-col gap-2 rounded-2xl border-2 border-dashed p-3 transition-colors ${
        isOver ? 'border-accent bg-accent/5' : 'border-border'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <div className="flex flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}
