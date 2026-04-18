// Single source of truth for the Forge access list. Every function that writes
// workspace data must pass through the helpers below so the policy can be
// tightened later (SSO allowlist, per-guild roles, etc.) without touching
// every call site.
//
// The owner email is overridable per deployment via the `OWNER_EMAIL` Convex
// env var so this repo can be cloned and operated by a different team without
// touching code. The default preserves the current owner on the Convex dev
// deployment. Flagged in the 2026-04-18 security audit (finding LOW #7).

const ALLOWED_EMAIL_SUFFIX = "@convex.dev";
const DEFAULT_OWNER_EMAIL = "wayne@convex.dev";

function ownerEmail(): string {
  const raw = process.env.OWNER_EMAIL;
  if (raw && raw.trim().length > 0) {
    return raw.trim().toLowerCase();
  }
  return DEFAULT_OWNER_EMAIL;
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(ALLOWED_EMAIL_SUFFIX);
}

export function roleForEmail(
  email: string | null | undefined,
): "owner" | "admin" {
  return email?.trim().toLowerCase() === ownerEmail() ? "owner" : "admin";
}
