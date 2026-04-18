import { useState, type ReactNode } from "react";

export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {children}
      <span
        role="tooltip"
        className={
          open
            ? "pointer-events-none absolute bottom-[calc(100%+0.6rem)] left-1/2 z-20 w-56 -translate-x-1/2 rounded-xl border border-[color-mix(in_oklab,var(--color-ink)_10%,var(--color-border))] bg-[var(--color-ink)] px-3 py-2 text-xs leading-5 text-[color-mix(in_oklab,white_88%,var(--color-bg))] shadow-[0_14px_30px_rgba(0,0,0,0.18)]"
            : "pointer-events-none absolute bottom-[calc(100%+0.6rem)] left-1/2 z-20 w-56 -translate-x-1/2 rounded-xl border border-[color-mix(in_oklab,var(--color-ink)_10%,var(--color-border))] bg-[var(--color-ink)] px-3 py-2 text-xs leading-5 text-[color-mix(in_oklab,white_88%,var(--color-bg))] opacity-0 shadow-[0_14px_30px_rgba(0,0,0,0.18)]"
        }
      >
        {content}
      </span>
    </span>
  );
}
