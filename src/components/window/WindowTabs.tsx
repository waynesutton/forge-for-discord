import { Link } from "react-router";

export type WindowTab = {
  to: string;
  label: string;
  active?: boolean;
};

export function WindowTabs({ tabs }: { tabs: Array<WindowTab> }) {
  return (
    <nav
      aria-label="Workspace sections"
      className="flex flex-wrap gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          aria-current={tab.active ? "page" : undefined}
          className={
            tab.active
              ? "rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-2 text-sm font-medium text-[var(--color-surface)]"
              : "rounded-[var(--radius-window)] border border-transparent px-3 py-2 text-sm font-medium text-[var(--color-muted)] transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
