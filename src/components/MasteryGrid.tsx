import type { GroupStats, MasteryLevel } from '../domain/mastery';

interface MasteryGridProps {
  groups: string[];
  groupStats: Record<string, GroupStats>;
  classify: (stats: GroupStats) => MasteryLevel;
  isEligible: (stats: GroupStats) => boolean;
  emptyStats: () => GroupStats;
  onChallengeBoss: (group: string) => void;
}

const LEVEL_LABEL: Record<MasteryLevel, string> = {
  locked: 'Locked',
  learning: 'Learning',
  mastered: 'Mastered'
};

const LEVEL_DOT: Record<MasteryLevel, string> = {
  locked: 'bg-border',
  learning: 'bg-accent',
  mastered: 'bg-accent'
};

export default function MasteryGrid({ groups, groupStats, classify, isEligible, emptyStats, onChallengeBoss }: MasteryGridProps) {
  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => {
        const stats = groupStats[group] ?? emptyStats();
        const level = classify(stats);
        const eligible = isEligible(stats);
        return (
          <li
            key={group}
            className="flex min-h-touch items-center justify-between rounded-xl border border-border bg-surface-alt px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${LEVEL_DOT[level]} ${level === 'mastered' ? '' : ''}`}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium">{group}</p>
                <p className="text-xs text-ink-muted">
                  {LEVEL_LABEL[level]} · {stats.attempts} attempt{stats.attempts === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!eligible}
              onClick={() => onChallengeBoss(group)}
              className="min-h-touch min-w-touch rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
            >
              Boss
            </button>
          </li>
        );
      })}
    </ul>
  );
}
