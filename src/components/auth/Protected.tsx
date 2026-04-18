import { Navigate, Outlet, useLocation } from "react-router";
import { CircleNotch } from "@phosphor-icons/react";
import { useAuth } from "../../hooks/useAuth";
import { useEnsureAppUser } from "../../hooks/useEnsureAppUser";
import type { ProtectedContext } from "../../hooks/useMe";

// Route gate for /app/*. Composes two hooks:
//   - useAuth()           -> reactive snapshot of the Robel auth client.
//   - useEnsureAppUser()  -> access probe + keeps the app-level `users` row
//                            in sync for allowed accounts.
// Four outcomes:
//   1. Auth still hydrating               -> spinner
//   2. Unauthenticated                    -> /auth/sign-in
//   3. Authenticated, not on allowlist    -> /auth/denied
//   4. Authenticated + allowed + user row -> render <Outlet />
// No raw effects live here (see react-effect-decision skill).
export function Protected() {
  const location = useLocation();
  const { isAuthenticated, isLoading, phase } = useAuth();
  const { access, me } = useEnsureAppUser(isAuthenticated);

  if (isLoading || phase === "loading" || phase === "handshake") {
    return <FullscreenSpinner label="Signing you in" />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth/sign-in"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (access === undefined) {
    return <FullscreenSpinner label="Checking access" />;
  }

  if (!access.allowed) {
    return <Navigate to="/auth/denied" replace />;
  }

  if (me === undefined || me === null) {
    return <FullscreenSpinner label="Preparing your workspace" />;
  }

  const context: ProtectedContext = { me };
  return <Outlet context={context} />;
}

function FullscreenSpinner({ label }: { label: string }) {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-dvh items-center justify-center bg-[var(--color-bg)]"
    >
      <div className="flex items-center gap-3 text-[var(--color-muted)]">
        <CircleNotch size={18} weight="bold" className="animate-spin" />
        <span className="text-sm">{label}</span>
      </div>
    </main>
  );
}
