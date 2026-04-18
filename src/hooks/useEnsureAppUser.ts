import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

export type AccessState = {
  authenticated: boolean;
  allowed: boolean;
  email?: string;
};

// External synchronization: the Robel auth component owns the canonical
// identity store; Forge keeps a mirrored row in the `users` table so every
// query can resolve roles and profile fields without round-tripping through
// the component. After the OAuth redirect there is no click handler to hang
// the upsert off of, so this is the narrow "true external synchronization"
// case from the react-effect-decision skill (rule 8). The effect is isolated
// in a focused hook so callers never see raw lifecycle code.
//
// Two Convex reads:
//   1. `api.users.access` is cheap (no DB) and gates everything else.
//   2. `api.users.me` only fires once access is allowed. Skipping the query
//      for denied users keeps bandwidth at zero and avoids surfacing stale
//      rows for accounts that should not be in the workspace.
export function useEnsureAppUser(isAuthenticated: boolean): {
  access: AccessState | undefined;
  me: Doc<"users"> | null | undefined;
} {
  const access = useQuery(api.users.access, isAuthenticated ? {} : "skip");
  const allowed = access?.allowed === true;

  const me = useQuery(api.users.me, allowed ? {} : "skip");
  const upsert = useMutation(api.users.upsertFromIdentity);

  useEffect(() => {
    if (allowed && me === null) {
      void upsert({});
    }
  }, [allowed, me, upsert]);

  return { access, me };
}
