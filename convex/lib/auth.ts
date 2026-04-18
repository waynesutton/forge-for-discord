// Shared workspace access guards. Each Forge file used to carry its own copy
// of these checks, which was easy to drift and gave the linter a
// `duplicated-auth` finding. Centralizing here keeps the rule set (allowed
// email, owner role, workspace user lookup) in one place.

import { ConvexError } from "convex/values";
import type {
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "../_generated/server";
import { auth } from "../auth";
import { isAllowedEmail } from "./access";

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

// Viewer profile surfaced by the Robel component. Fields mirror the subset
// Forge cares about; the component's full user type is wider.
type Viewer = {
  _id: unknown;
  email?: unknown;
  name?: unknown;
  image?: unknown;
};

// Throws when the caller is not authenticated or not on the allowlist.
// Returns the component viewer doc so callers can read email/name without a
// second round trip.
export async function requireAllowedViewer(ctx: AnyCtx): Promise<Viewer> {
  const viewer = (await auth.user.viewer(ctx)) as Viewer | null;
  if (!viewer) {
    throw new ConvexError({ code: "unauthenticated" });
  }
  const email = typeof viewer.email === "string" ? viewer.email : undefined;
  if (!isAllowedEmail(email)) {
    throw new ConvexError({ code: "access_denied" });
  }
  return viewer;
}

// Soft variant: returns null instead of throwing for signed-out callers, so
// list queries can render an empty state for the unauth view. Still throws
// on `access_denied` because that is a hard policy failure the UI should
// surface explicitly.
export async function optionalAllowedViewer(
  ctx: AnyCtx,
): Promise<Viewer | null> {
  const viewer = (await auth.user.viewer(ctx)) as Viewer | null;
  if (!viewer) return null;
  const email = typeof viewer.email === "string" ? viewer.email : undefined;
  if (!isAllowedEmail(email)) {
    throw new ConvexError({ code: "access_denied" });
  }
  return viewer;
}
