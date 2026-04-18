import { useState } from "react";
import { Navigate } from "react-router";
import { GithubLogo, CircleNotch, Lightning } from "@phosphor-icons/react";
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
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-bg)] px-6 py-20">
      <section
        className="w-full max-w-md overflow-hidden rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-window)]"
        aria-labelledby="signin-title">
        <header className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#f3665c]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#f6c75a]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#58c88f]" aria-hidden />
          <span className="ml-3 text-xs font-medium tracking-wide text-[var(--color-muted)]">
            forge / sign in
          </span>
        </header>

        <div className="flex flex-col gap-6 px-8 py-10">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)]">
              <Lightning size={20} weight="fill" color="var(--color-accent)" />
            </span>
            <div>
              <h1 id="signin-title" className="text-xl font-semibold tracking-tight">
                Sign in to Forge
              </h1>
              <p className="text-sm text-[var(--color-muted)]">
                Discord form builder and approval engine.
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
            <span>{pending ? "Redirecting to GitHub" : "Continue with GitHub"}</span>
          </button>

          {error ? (
            <p
              role="alert"
              className="rounded-[var(--radius-window)] border border-[var(--color-danger)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}

          <p className="text-xs text-[var(--color-muted)]">
            By signing in you agree to the Forge terms of use.
          </p>
        </div>
      </section>
    </main>
  );
}
