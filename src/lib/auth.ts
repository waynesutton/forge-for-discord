import { client } from "@robelest/convex-auth/browser";
import { api, internal } from "../../convex/_generated/api";
import type { AuthApiRefs } from "@robelest/convex-auth/browser";
import { convex } from "./convex";

// Browser auth client. Constructing it wires `convex.setAuth(...)` so every
// Convex query, mutation, and action automatically receives the JWT issued
// by the @robelest/convex-auth component.
//
// Type quirk: `AuthApiRefs.store` is declared as a `public` mutation, but the
// upstream component registers `store` as an `internal` mutation (see
// node_modules/@robelest/convex-auth/dist/server/runtime.d.ts line 662).
// That means `api.auth` only carries `signIn` + `signOut`, and `store` lands
// on `internal.auth`. We stitch the refs back together manually and cast to
// the lib's expected shape. Runtime works; only the types disagree.
const authApi = {
  signIn: api.auth.signIn,
  signOut: api.auth.signOut,
  store: internal.auth.store,
} as unknown as AuthApiRefs;

export const auth = client({
  convex,
  api: authApi,
});

const JWT_STORAGE_KEY = "__convexAuthJWT";
const REFRESH_TOKEN_STORAGE_KEY = "__convexAuthRefreshToken";
const OAUTH_VERIFIER_STORAGE_KEY = "__convexAuthOAuthVerifier";

let signOutInFlight: Promise<void> | null = null;

// Robel's browser client clears local auth after it finishes the server-side
// sign-out mutation. When the session is already stuck in a rapid
// `refreshSession` loop, that ordering loses a race against repeated refresh
// writes in the `RefreshToken` table and the server mutation can OCC forever.
//
// To break the loop deterministically we clear the local refresh inputs first:
//   1. Remove JWT + refresh token from localStorage.
//   2. Tell the shared Convex client to drop auth immediately.
//   3. Best-effort call the server `signOut()` once to invalidate the session.
//
// The module-level promise dedupes concurrent callers from Strict Mode remounts
// or multiple components trying to sign out at the same time.
export function signOutNow(): Promise<void> {
  if (signOutInFlight) {
    return signOutInFlight;
  }

  clearLocalAuthState();

  signOutInFlight = (async () => {
    try {
      await auth.signOut();
    } catch {
      // Local auth is already cleared; remote revocation is best effort.
    } finally {
      signOutInFlight = null;
    }
  })();

  return signOutInFlight;
}

function clearLocalAuthState(): void {
  const namespace = resolveAuthNamespace();
  if (typeof window !== "undefined" && namespace) {
    window.localStorage.removeItem(`${JWT_STORAGE_KEY}_${namespace}`);
    window.localStorage.removeItem(`${REFRESH_TOKEN_STORAGE_KEY}_${namespace}`);
    window.localStorage.removeItem(
      `${OAUTH_VERIFIER_STORAGE_KEY}_${namespace}`,
    );
  }

  convex.clearAuth?.();
}

function resolveAuthNamespace(): string {
  const candidate = convex as { url?: string; client?: { url?: string } };
  const url =
    typeof candidate.url === "string"
      ? candidate.url
      : typeof candidate.client?.url === "string"
        ? candidate.client.url
        : "";
  return url.replace(/[^a-zA-Z0-9]/g, "");
}
