import { useState } from "react";
import { Link } from "react-router";
import { Prohibit, SignIn as SignInIcon } from "@phosphor-icons/react";
import { useAuth } from "../hooks/useAuth";
import { useEnsureAppUser } from "../hooks/useEnsureAppUser";
import { useAutoSignOut } from "../hooks/useAutoSignOut";

// Final screen for authenticated GitHub accounts whose primary Convex email
// is not on the allowlist. We run `access` once to learn the email, then
// immediately sign the Robel client out so it stops auto-refreshing the
// JWT (the refresh loop is what caused the storm of `auth:signIn` calls in
// the Convex logs). The email we learned is cached in a `useMemo` so the
// message survives after `access` unmounts post-signout. A link sends the
// user back to / (the homepage, which renders SignIn) to try another account.
export function AccessDenied() {
  const { isAuthenticated } = useAuth();
  const { access } = useEnsureAppUser(isAuthenticated);

  // Latch the email the first time access resolves. After signOut fires the
  // access query unmounts and `access.email` flips back to undefined, so the
  // derived value needs its own component state. We follow React's documented
  // "adjusting state while rendering" pattern: the conditional `setState` is
  // a no-op on subsequent renders because `latchedEmail` is already set.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [latchedEmail, setLatchedEmail] = useState<string | undefined>(
    undefined,
  );
  if (access?.email && latchedEmail === undefined) {
    setLatchedEmail(access.email);
  }
  const cachedEmail = access?.email ?? latchedEmail;

  useAutoSignOut(
    access !== undefined && access.authenticated && !access.allowed,
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-bg)] px-6 py-20">
      <section
        className="w-full max-w-md overflow-hidden rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-window)]"
        aria-labelledby="denied-title"
      >
        <header className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#f3665c]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#f6c75a]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#58c88f]" aria-hidden />
          <span className="ml-3 text-xs font-medium tracking-wide text-[var(--color-muted)]">
            forge / access denied
          </span>
        </header>

        <div className="flex flex-col gap-6 px-8 py-10">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)]">
              <Prohibit
                size={20}
                weight="fill"
                color="var(--color-danger)"
              />
            </span>
            <div>
              <h1
                id="denied-title"
                className="text-xl font-semibold tracking-tight"
              >
                This account can't use Forge
              </h1>
              <p className="text-sm text-[var(--color-muted)]">
                Forge is limited to Convex team accounts.
              </p>
            </div>
          </div>

          {cachedEmail ? (
            <p className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-ink)]">
              Signed in as <span className="font-medium">{cachedEmail}</span>.
              That address is not on the Convex team allowlist.
            </p>
          ) : null}

          <p className="text-sm text-[var(--color-muted)]">
            Sign in with a GitHub account whose primary email ends in
            <span className="font-mono"> @convex.dev</span> to continue.
          </p>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-[var(--color-surface)] shadow-[var(--shadow-window)] transition-transform duration-150 active:translate-y-px"
          >
            <SignInIcon size={16} weight="bold" aria-hidden />
            <span>Use a different account</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
