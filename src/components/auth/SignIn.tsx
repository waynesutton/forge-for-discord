import { useState } from "react";
import { Link, Navigate } from "react-router";
import {
  BookOpen,
  GithubLogo,
  CircleNotch,
  Lightning,
  SlidersHorizontal,
  CheckSquare,
  Ticket,
  ClipboardText,
  Export,
  LockKey,
  ChatCircleText,
} from "@phosphor-icons/react";
import { useAuth } from "../../hooks/useAuth";

// Single-screen sign-in. Phase 1 only supports GitHub OAuth; additional providers
// are wired from convex/auth.ts and land on this screen without markup changes.
export function SignIn() {
  const { isAuthenticated, phase, signIn } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (phase === "authenticated" || isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  const handleGitHub = async () => {
    setPending(true);
    setError(null);
    try {
      await signIn("github");
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Sign in failed. Try again.");
    }
  };

  return (
    <main className="flex min-h-dvh justify-center bg-[var(--color-bg)] px-6 pt-12 pb-16 sm:pt-16">
      <div className="flex w-full max-w-md flex-col gap-6">
        <section
          className="w-full overflow-hidden rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-window)]"
          aria-labelledby="signin-title">
          <header className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-[#f3665c]" aria-hidden />
            <span className="h-3 w-3 rounded-full bg-[#f6c75a]" aria-hidden />
            <span className="h-3 w-3 rounded-full bg-[#58c88f]" aria-hidden />
            <span className="ml-3 text-xs font-medium tracking-wide text-[var(--color-muted)]">
              forge / sign in
            </span>
          </header>

          <div className="flex flex-col gap-6 px-8 py-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)]">
                <Lightning size={20} weight="fill" color="var(--color-accent)" />
              </span>
              <div>
                <h1 id="signin-title" className="text-xl font-semibold tracking-tight">
                  Sign in to Forge
                </h1>
                <p className="text-sm text-[var(--color-muted)]">
                  Design Discord forms and review submissions in one place.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGitHub}
              disabled={pending}
              className="group flex items-center justify-center gap-3 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-5 py-3 text-sm font-medium text-[var(--color-surface)] shadow-[var(--shadow-window)] transition-transform duration-150 active:translate-y-px disabled:cursor-progress disabled:opacity-70">
              {pending ? (
                <CircleNotch size={18} weight="bold" className="animate-spin" aria-hidden />
              ) : (
                <GithubLogo size={18} weight="fill" aria-hidden />
              )}
              <span>{pending ? "Opening GitHub" : "Continue with GitHub"}</span>
            </button>

            {error ? (
              <p
                role="alert"
                className="rounded-[var(--radius-window)] border border-[var(--color-danger)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-danger)]">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
              <p className="text-xs text-[var(--color-muted)]">For Convex by Convex.</p>
              {/* Public docs link. Same route a logged-in admin sees, so
                  anyone evaluating Forge can read the setup guide before
                  requesting access. */}
              <Link
                to="/docs"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink)] underline decoration-[var(--color-border)] underline-offset-4 transition-colors hover:decoration-[var(--color-ink)]">
                <BookOpen size={14} weight="bold" aria-hidden />
                <span>Read the setup guide</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Feature list sits under the sign-in card so the fold stays focused on the button */}
        <section
          aria-label="What you can build with Forge"
          className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-[var(--shadow-window)]">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Inside Forge
          </p>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <FeatureRow
              icon={<SlidersHorizontal size={16} weight="bold" />}
              label="Visual form builder"
            />
            <FeatureRow
              icon={<Lightning size={16} weight="fill" />}
              label="One-click slash commands"
            />
            <FeatureRow
              icon={<CheckSquare size={16} weight="bold" />}
              label="Mod queue approvals"
            />
            <FeatureRow icon={<Ticket size={16} weight="bold" />} label="Ticket mode" />
            <FeatureRow
              icon={<ClipboardText size={16} weight="bold" />}
              label="Per form audit log"
            />
            <FeatureRow
              icon={<Export size={16} weight="bold" />}
              label="CSV and PDF export"
            />
            <FeatureRow
              icon={<LockKey size={16} weight="bold" />}
              label="Private fields stay private"
            />
            <FeatureRow
              icon={<ChatCircleText size={16} weight="bold" />}
              label="Reply from the dashboard"
            />
          </ul>
        </section>
      </div>
    </main>
  );
}

// Single feature row in the under-card list. Icon plus label, aligned on a small grid.
function FeatureRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2 text-[var(--color-ink)]">
      <span className="flex h-6 w-6 items-center justify-center text-[var(--color-accent)]">
        {icon}
      </span>
      <span>{label}</span>
    </li>
  );
}
