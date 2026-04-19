import { useState } from "react";
import { Link, Navigate } from "react-router";
import {
  BookOpen,
  GithubLogo,
  CircleNotch,
  DiscordLogo,
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

// External URLs shown on the landing page footer row so visitors who land on
// the sign-in screen can still reach the source and community without
// authenticating.
const REPO_URL = "https://github.com/waynesutton/forge-for-discord";
const CONVEX_COMMUNITY_URL = "https://www.convex.dev/community";

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
              <span className="flex aspect-square h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)]">
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

            {/* Footer row. Left side carries the attribution plus the About
                link for visitors who want the marketing story. Right side is
                an icon row pointing to the setup guide, the public repo, and
                the Convex community Discord so anyone who cannot sign in
                (this hosted instance is team-only) can still explore the
                project. */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
              <p className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                <span>For Discord servers built with Convex.</span>
                <Link
                  to="/about"
                  className="font-medium text-[var(--color-ink)] underline decoration-[var(--color-border)] underline-offset-4 transition-colors hover:decoration-[var(--color-ink)]">
                  About
                </Link>
              </p>
              <div className="flex items-center gap-1">
                <LandingIconLink to="/docs" label="Read the setup guide">
                  <BookOpen size={14} weight="bold" aria-hidden />
                </LandingIconLink>
                <LandingIconLink href={REPO_URL} label="View Forge on GitHub">
                  <GithubLogo size={14} weight="bold" aria-hidden />
                </LandingIconLink>
                <LandingIconLink
                  href={CONVEX_COMMUNITY_URL}
                  label="Join the Convex community Discord">
                  <DiscordLogo size={14} weight="fill" aria-hidden />
                </LandingIconLink>
              </div>
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

// Icon-only pill used in the sign-in card footer. Accepts either a
// react-router `to` (internal) or an external `href`. aria-label carries the
// accessible name because the visible content is only an icon.
function LandingIconLink({
  to,
  href,
  label,
  children,
}: {
  to?: string;
  href?: string;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]";
  if (to) {
    return (
      <Link to={to} aria-label={label} title={label} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={className}>
      {children}
    </a>
  );
}
