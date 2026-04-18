import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";

// External synchronization: once we've decided the current session is
// not allowed in Forge, we must sign the Robel browser client out so it
// stops auto-refreshing the JWT (which otherwise pings `auth:signIn`
// every few hundred ms for the lifetime of /auth/denied). This fires
// `signOut()` exactly once per mount, guarded by a ref so React Strict
// Mode double-invokes and token-change re-renders don't re-fire it.
// See react-effect-decision skill, rule 8 ("true external sync").
export function useAutoSignOut(shouldSignOut: boolean): void {
  const { signOut, isAuthenticated } = useAuth();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!shouldSignOut) return;
    if (firedRef.current) return;
    if (!isAuthenticated) return;
    firedRef.current = true;
    void signOut();
  }, [shouldSignOut, signOut, isAuthenticated]);
}
