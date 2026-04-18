import type { ReactNode } from "react";

export function WindowFrame({
  label,
  title,
  description,
  action,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-window)]">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#f3665c]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#f6c75a]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#58c88f]" aria-hidden />
          <span className="ml-3 truncate text-xs font-medium tracking-wide text-[var(--color-muted)]">
            {label}
          </span>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      <div className="flex flex-col gap-6 px-8 py-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="max-w-2xl text-sm text-[var(--color-muted)]">
              {description}
            </p>
          ) : null}
        </div>

        {children}
      </div>
    </section>
  );
}
