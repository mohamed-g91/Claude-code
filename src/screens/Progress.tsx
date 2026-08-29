import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContentBundle } from '../content/loader';
import { getStorage } from '../storage/dexie';
import { classifyMastery, isBossEligible, emptyGroupStats } from '../domain/mastery';
import MasteryGrid from '../components/MasteryGrid';
import type { Profile } from '../storage/provider';
import { defaultProfile } from '../storage/provider';
import type { AttemptRow } from '../storage/schema';
import { xpForLevel } from '../domain/scoring';

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export default function Progress() {
  const navigate = useNavigate();
  const bundleState = useContentBundle();
  const storage = getStorage();

  const [profile, setProfile] = useState<Profile>(defaultProfile());
  const [groupStats, setGroupStats] = useState<Record<string, { attempts: number; correct: number }>>({});
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);

  useEffect(() => {
    storage.getProfile().then(setProfile);
    storage.getAllGroupStats().then(setGroupStats);
    storage.getAttempts(1000).then(setAttempts);
  }, [storage]);

  const last14Days: string[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });

  const attemptsByDay = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    const key = dayKey(a.answeredAt);
    const cur = attemptsByDay.get(key) ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (a.isCorrect) cur.correct += 1;
    attemptsByDay.set(key, cur);
  }

  const xpIntoLevel = profile.score.xp - xpForLevel(profile.score.level);
  const xpForNext = xpForLevel(profile.score.level + 1) - xpForLevel(profile.score.level);

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface-alt p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Level</p>
          <p className="mt-1 text-3xl font-semibold">{profile.score.level}</p>
          <p className="text-xs text-ink-muted">
            {Math.max(0, xpIntoLevel)} / {Math.max(1, xpForNext)} XP
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-alt p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Best streak</p>
          <p className="mt-1 text-3xl font-semibold">{profile.streak.longest}</p>
          <p className="text-xs text-ink-muted">days</p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-muted">Last 14 days</h2>
        <div className="flex gap-1" data-testid="streak-calendar">
          {last14Days.map((day) => {
            const stats = attemptsByDay.get(day);
            const active = !!stats && stats.total > 0;
            const acc = stats && stats.total > 0 ? stats.correct / stats.total : 0;
            return (
              <div
                key={day}
                title={`${day}: ${stats?.total ?? 0} answered`}
                className={`h-6 flex-1 rounded ${active ? (acc >= 0.7 ? 'bg-good/70' : 'bg-accent/60') : 'bg-border'}`}
              />
            );
          })}
        </div>
      </section>

      {bundleState.status === 'ready' && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Topic mastery</h2>
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
