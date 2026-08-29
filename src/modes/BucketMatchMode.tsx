import { useMemo, useState } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import SessionShell from '../components/SessionShell';
import DraggableTile from '../components/DraggableTile';
import DropBucket from '../components/DropBucket';
import { useAnswerEngine } from '../app/useAnswerEngine';
import type { ContentBundle } from '../content/loader';
import type { StorageProvider } from '../storage/provider';
import type { BucketMatchRound } from '../content/types';

interface BucketMatchModeProps {
  bundle: ContentBundle;
  storage: StorageProvider;
}

interface PoolTile {
  id: string; // questionId, unique within a round
  text: string;
  trueGroup: string;
}

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function BucketMatchMode({ bundle, storage }: BucketMatchModeProps) {
  const rounds = bundle.playItems.modes.bucketMatch;
  const [roundIndex, setRoundIndex] = useState(0);
  const round: BucketMatchRound | undefined = rounds[roundIndex];

  const { submitAnswer } = useAnswerEngine(storage);

  const pool = useMemo(() => {
    if (!round) return [];
    const tiles: PoolTile[] = round.buckets.flatMap((b) => b.tiles.map((t) => ({ id: t.questionId, text: t.text, trueGroup: b.group })));
    return shuffle(tiles);
  }, [round]);

  const [placements, setPlacements] = useState<Record<string, string>>({}); // tileId -> bucketGroup dropped into
  const [feedback, setFeedback] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [combo, setCombo] = useState(0);
  const [roundComplete, setRoundComplete] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  if (!round) {
    return (
      <SessionShell title="Bucket Match" current={0} total={0} combo={0} xpEarned={0}>
        <p className="text-sm text-ink-muted">Not enough questions to build a Bucket Match round yet.</p>
      </SessionShell>
    );
  }

  const placedCount = Object.keys(placements).length;

  async function place(tileId: string, bucketGroup: string) {
    if (placements[tileId]) return; // already placed
    const tile = pool.find((t) => t.id === tileId);
    if (!tile) return;
    const isCorrect = tile.trueGroup === bucketGroup;

    setPlacements((prev) => ({ ...prev, [tileId]: bucketGroup }));
    setFeedback((prev) => ({ ...prev, [tileId]: isCorrect ? 'correct' : 'incorrect' }));
    setSelectedTileId(null);

    const result = await submitAnswer({ questionId: tile.id, group: tile.trueGroup, mode: 'bucketMatch', isCorrect });
    setCorrectCount((c) => c + (isCorrect ? 1 : 0));
    setCombo(result.newProfile.score.combo);
    setXpEarned(result.newProfile.score.xp);

    if (placedCount + 1 >= pool.length) {
      setRoundComplete(true);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    void place(String(active.id), String(over.id));
  }

  function handleTapTile(tileId: string) {
    if (placements[tileId]) return;
    setSelectedTileId((current) => (current === tileId ? null : tileId));
  }

  function handleTapBucket(bucketGroup: string) {
    if (!selectedTileId) return;
    void place(selectedTileId, bucketGroup);
  }

  function nextRound() {
    setPlacements({});
    setFeedback({});
    setSelectedTileId(null);
    setRoundComplete(false);
    setRoundIndex((i) => (i + 1) % rounds.length);
  }

  return (
    <SessionShell
      title="Bucket Match"
      current={placedCount}
      total={pool.length}
      combo={combo}
      xpEarned={xpEarned}
      complete={roundComplete}
      correctCount={correctCount}
      onExit={roundComplete ? nextRound : undefined}
    >
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <p className="mb-3 text-sm text-ink-muted">
          Tap a tile, then tap a bucket — or drag it straight in.
        </p>
        {/* The tile pool scrolls within a bounded area and the buckets stay pinned
            below it, so a drop target is always on screen. Without this the nine
            tiles push all three buckets below the fold and dragging is unusable. */}
        <div
          className="mb-3 flex max-h-[40vh] flex-wrap gap-2 overflow-y-auto overscroll-contain"
          data-testid="tile-pool"
        >
          {pool
            .filter((t) => !placements[t.id])
            .map((tile) => (
              <DraggableTile
                key={tile.id}
                id={tile.id}
                text={tile.text}
                selected={selectedTileId === tile.id}
                onTap={() => handleTapTile(tile.id)}
              />
            ))}
        </div>

        <div className="sticky bottom-0 grid grid-cols-3 gap-2 bg-surface pb-1 pt-2">
          {round.buckets.map((bucket) => (
            <DropBucket key={bucket.group} id={bucket.group} label={bucket.group} onTapPlace={() => handleTapBucket(bucket.group)}>
              {pool
                .filter((t) => placements[t.id] === bucket.group)
                .map((tile) => (
                  <DraggableTile
                    key={tile.id}
                    id={tile.id}
                    text={tile.text}
                    selected={false}
                    disabled
                    feedback={feedback[tile.id]}
                    onTap={() => {}}
                  />
                ))}
            </DropBucket>
          ))}
        </div>
      </DndContext>
    </SessionShell>
  );
}
