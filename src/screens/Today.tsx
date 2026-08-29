import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContentBundle } from '../content/loader';
import { getStorage } from '../storage/dexie';
import { isDue, createInitialCardState } from '../domain/srs';
import { isStreakAtRisk } from '../domain/streak';
import type { Profile } from '../storage/provider';
import { defaultProfile } from '../storage/provider';

export default function Today() {
  const navigate = useNavigate();
  const bundleState = useContentBundle();
  const storage = getStorage();
  const [profile, setProfile] = useState<Profile>(defaultProfile());
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [answeredToday, setAnsweredToday] = useState(0);

  useEffect(() => {
    storage.getProfile().then(setProfile);
  }, [storage]);

  useEffect(() => {
    if (bundleState.status !== 'ready') return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      const cardStates = await storage.getAllCardStates();
      let due = 0;
      for (const q of bundleState.bundle.content.questions) {
        const state = cardStates[q.id] ?? createInitialCardState(now);
        if (isDue(state, now)) due++;
      }
      const attempts = await storage.getAttempts(500);
      const todayKey = now.toDateString();
      const todaysAttempts = attempts.filter((a) => new Date(a.answeredAt).toDateString() === todayKey);
      if (!cancelled) {
        setDueCount(due);
        setAnsweredToday(todaysAttempts.length);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bundleState, storage]);

  const goalProgress = Math.min(1, answeredToday / Math.max(1, profile.dailyGoal));
  const atRisk = isStreakAtRisk(profile.streak);

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-6">
      <header>
        <p className="text-sm font-medium text-ink-muted">MRCP Part 1</p>
        <h1 className="text-2xl font-semibold tracking-tight">Cardiology</h1>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface-alt p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Due now</p>
          <p className="mt-1 text-3xl font-semibold" data-testid="due-count">
            {dueCount ?? '–'}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-alt p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Streak</p>
          <p className="mt-1 text-3xl font-semibold">
            {profile.streak.current}
            <span className="ml-1 text-base font-normal text-ink-muted">days</span>
          </p>
          {atRisk && profile.streak.current > 0 && (
            <p className="mt-1 text-xs text-bad">Play today to keep it going</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-alt p-4 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Daily goal</p>
          <p className="text-sm text-ink-muted">
            {answeredToday} / {profile.dailyGoal}
          </p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${goalProgress * 100}%` }}
          />
        </div>
      </section>

      <button
        type="button"
        className="min-h-touch rounded-2xl bg-accent px-6 py-4 text-base font-semibold text-accent-ink shadow-card"
        onClick={() => navigate(dueCount && dueCount > 0 ? '/session/review' : '/session/mcq')}
      >
        {dueCount && dueCount > 0 ? `Start review (${dueCount} due)` : 'Start a session'}
      </button>

      <button
        type="button"
        className="min-h-touch rounded-2xl border border-border px-6 py-3 text-sm font-medium text-ink-muted"
        onClick={() => navigate('/practice')}
      >
        Browse all modes
      </button>
    </div>
  );
}
