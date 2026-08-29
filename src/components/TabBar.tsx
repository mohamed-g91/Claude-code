import { NavLink } from 'react-router-dom';

interface Tab {
  to: string;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { to: '/', label: 'Today', icon: '☀' },
  { to: '/practice', label: 'Practice', icon: '♥' },
  { to: '/progress', label: 'Progress', icon: '↑' },
  { to: '/settings', label: 'Settings', icon: '⚙' }
];

export default function TabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface-alt pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex min-h-touch flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium ${
                  isActive ? 'text-accent' : 'text-ink-muted'
                }`
              }
            >
              <span aria-hidden="true" className="text-lg leading-none">
                {tab.icon}
              </span>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
