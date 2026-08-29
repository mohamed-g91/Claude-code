import { useEffect, useState } from 'react';
import { useContentBundle } from '../content/loader';
import { getStorage } from '../storage/dexie';
import type { Profile } from '../storage/provider';
import { defaultProfile } from '../storage/provider';

export default function Settings() {
  const bundleState = useContentBundle();
  const storage = getStorage();
  const [profile, setProfile] = useState<Profile>(defaultProfile());
  const [resetConfirming, setResetConfirming] = useState(false);

  useEffect(() => {
    storage.getProfile().then(setProfile);
  }, [storage]);

  function updateProfile(patch: Partial<Profile>) {
    const next = { ...profile, ...patch };
    setProfile(next);
    void storage.saveProfile(next);
  }

  function applyTheme(theme: Profile['theme']) {
    updateProfile({ theme });
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }

  async function resetProgress() {
    await storage.resetAll();
    setProfile(defaultProfile());
    setResetConfirming(false);
  }

  const content = bundleState.status === 'ready' ? bundleState.bundle.content : null;

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <section className="rounded-2xl border border-border bg-surface-alt p-4 shadow-card">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">Daily goal</span>
          <input
            type="number"
            min={5}
            max={200}
            step={5}
            value={profile.dailyGoal}
            onChange={(e) => updateProfile({ dailyGoal: Number(e.target.value) || profile.dailyGoal })}
            className="min-h-touch w-20 rounded-lg border border-border bg-surface px-2 text-right"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-border bg-surface-alt p-4 shadow-card">
        <p className="mb-2 text-sm font-medium">Theme</p>
        <div className="flex gap-2">
          {(['system', 'light', 'dark'] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => applyTheme(theme)}
              className={`min-h-touch flex-1 rounded-xl border px-3 py-2 text-sm capitalize ${
                profile.theme === theme ? 'border-accent bg-accent/10 text-accent' : 'border-border'
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-alt p-4 shadow-card">
        <p className="mb-2 text-sm font-medium">Content health</p>
        {content ? (
          <ul className="space-y-1 text-sm text-ink-muted">
            <li>{content.label}: {content.questionCount} questions</li>
            <li>{content.questions.filter((q) => q.incomplete).length} incomplete (MCQ-only, no vignette)</li>
            <li>Source: {content.sourceDatabase}</li>
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">Loading…</p>
        )}
      </section>

      <section className="rounded-2xl border border-bad/30 bg-bad/5 p-4">
        <p className="mb-2 text-sm font-medium text-bad">Danger zone</p>
        {resetConfirming ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void resetProgress()}
              className="min-h-touch flex-1 rounded-xl bg-bad px-3 py-2 text-sm font-semibold text-white"
            >
              Confirm reset
            </button>
            <button
              type="button"
              onClick={() => setResetConfirming(false)}
              className="min-h-touch flex-1 rounded-xl border border-border px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setResetConfirming(true)}
            className="min-h-touch rounded-xl border border-bad px-3 py-2 text-sm font-medium text-bad"
          >
            Reset all progress
          </button>
        )}
      </section>
    </div>
  );
}
