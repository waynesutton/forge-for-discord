// Single source of truth for the Forge access list. Every function that writes
// workspace data must pass through the helpers below so the policy can be
// tightened later (SSO allowlist, per-guild roles, etc.) without touching
// every call site.

const ALLOWED_EMAIL_SUFFIX = "@convex.dev";
const OWNER_EMAIL = "wayne@convex.dev";

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(ALLOWED_EMAIL_SUFFIX);
}

export function roleForEmail(
  email: string | null | undefined,
): "owner" | "admin" {
  return email?.trim().toLowerCase() === OWNER_EMAIL ? "owner" : "admin";
}
