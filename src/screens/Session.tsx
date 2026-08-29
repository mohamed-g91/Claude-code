import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useContentBundle } from '../content/loader';
import { getStorage } from '../storage/dexie';
import { createInitialCardState } from '../domain/srs';
import { selectDue, selectForBoss, type SrsEntry } from '../domain/selectors';
import { isBossEligible } from '../domain/mastery';
import McqMode from '../modes/McqMode';
import RapidFireMode from '../modes/RapidFireMode';
import SwipeMode from '../modes/SwipeMode';
import PairMatchMode from '../modes/PairMatchMode';
import BucketMatchMode from '../modes/BucketMatchMode';
import type { Question } from '../content/types';

export default function Session() {
  const { mode } = useParams<{ mode: string }>();
  const [searchParams] = useSearchParams();
  const bundleState = useContentBundle();
  const storage = getStorage();

  const [entries, setEntries] = useState<SrsEntry[] | null>(null);
  const [bossGate, setBossGate] = useState<'checking' | 'locked' | 'open'>('checking');

  useEffect(() => {
    if (bundleState.status !== 'ready') return;
    if (mode !== 'review' && mode !== 'boss') return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      const cardStates = await storage.getAllCardStates();
      const list: SrsEntry[] = bundleState.bundle.content.questions.map((q) => ({
        question: q,
        cardState: cardStates[q.id] ?? createInitialCardState(now)
      }));

      if (mode === 'review') {
        if (!cancelled) setEntries(selectDue(list, now, 20));
        return;
      }

      const group = searchParams.get('group') ?? '';
      const groupStats = await storage.getGroupStats(group);
      if (cancelled) return;
      if (!isBossEligible(groupStats)) {
        setBossGate('locked');
        return;
      }
      setBossGate('open');
      setEntries(selectForBoss(list, group, 5));
    })();
    return () => {
      cancelled = true;
    };
  }, [bundleState, mode, storage, searchParams]);

  if (bundleState.status === 'loading') {
    return <p className="px-4 py-6 text-sm text-ink-muted">Loading content…</p>;
  }
  if (bundleState.status === 'error') {
    return <p className="px-4 py-6 text-sm text-bad">Could not load content: {bundleState.error.message}</p>;
  }

  const { bundle } = bundleState;

  switch (mode) {
    case 'mcq':
      return <McqMode bundle={bundle} storage={storage} />;
    case 'rapidFire':
      return <RapidFireMode bundle={bundle} storage={storage} />;
    case 'swipeSort':
      return <SwipeMode bundle={bundle} storage={storage} />;
    case 'pairMatch':
      return <PairMatchMode bundle={bundle} storage={storage} />;
    case 'bucketMatch':
      return <BucketMatchMode bundle={bundle} storage={storage} />;
    case 'review': {
      if (entries === null) return <p className="px-4 py-6 text-sm text-ink-muted">Loading review queue…</p>;
      const questions: Question[] = entries.map((e) => e.question);
      if (questions.length === 0) {
        return <p className="px-4 py-6 text-sm text-ink-muted">Nothing due right now — nice work.</p>;
      }
      return <McqMode bundle={bundle} storage={storage} questions={questions} title="Review" sessionLength={questions.length} />;
    }
    case 'boss': {
      const group = searchParams.get('group') ?? '';
      if (bossGate === 'checking') return <p className="px-4 py-6 text-sm text-ink-muted">Loading boss battle…</p>;
      if (bossGate === 'locked') {
        return (
          <p className="px-4 py-6 text-sm text-ink-muted">
            Practice {group} a bit more before challenging its boss.
          </p>
        );
      }
      const questions: Question[] = (entries ?? []).map((e) => e.question);
      return (
        <McqMode
          bundle={bundle}
          storage={storage}
          questions={questions}
          title={`${group} boss`}
          mode="boss"
          sessionLength={questions.length}
        />
      );
    }
    default:
      return <p className="px-4 py-6 text-sm text-bad">Unknown mode: {mode}</p>;
  }
}
