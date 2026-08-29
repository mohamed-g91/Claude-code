import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContentBundle } from '../content/loader';
import { getStorage } from '../storage/dexie';
import { classifyMastery, isBossEligible, emptyGroupStats } from '../domain/mastery';
import MasteryGrid from '../components/MasteryGrid';

const MODES: { mode: string; title: string; blurb: string }[] = [
  { mode: 'review', title: 'Review', blurb: 'Due cards, spaced repetition' },
  { mode: 'rapidFire', title: 'Rapid Fire', blurb: 'Fast MCQs, weighted by weak spots' },
  { mode: 'swipeSort', title: 'Swipe Sort', blurb: 'Swipe right if it is the right management' },
  { mode: 'pairMatch', title: 'Pair Match', blurb: 'Match the vignette to its answer' },
  { mode: 'bucketMatch', title: 'Bucket Match', blurb: 'Sort answers into the right topic' }
];

export default function Practice() {
  const navigate = useNavigate();
  const bundleState = useContentBundle();
  const storage = getStorage();
  const [groupStats, setGroupStats] = useState<Record<string, { attempts: number; correct: number }>>({});

  useEffect(() => {
    storage.getAllGroupStats().then(setGroupStats);
  }, [storage]);

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Practice</h1>
        <p className="text-sm text-ink-muted">Pick a mode</p>
      </header>

      <section className="flex flex-col gap-3">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            className="min-h-touch rounded-2xl border border-border bg-surface-alt p-4 text-left shadow-card"
            onClick={() => navigate(`/session/${m.mode}`)}
          >
            <p className="font-semibold">{m.title}</p>
            <p className="text-sm text-ink-muted">{m.blurb}</p>
          </button>
        ))}
      </section>

      {bundleState.status === 'ready' && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Topics &amp; bosses</h2>
          <MasteryGrid
            groups={bundleState.bundle.groups}
            groupStats={groupStats}
            onChallengeBoss={(group) => navigate(`/session/boss?group=${encodeURIComponent(group)}`)}
            classify={classifyMastery}
            isEligible={isBossEligible}
            emptyStats={emptyGroupStats}
          />
        </section>
      )}
    </div>
  );
}
