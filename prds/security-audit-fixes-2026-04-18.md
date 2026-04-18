# Security audit fixes 2026-04-18

Created: 2026-04-18 22:53 UTC
Last Updated: 2026-04-18 22:53 UTC
Status: In Progress

## Problem

The security audit on 2026-04-18 flagged seven findings (`changelog.md` unreleased security entry). This PRD captures the concrete, scoped fixes we are shipping now without breaking the existing shared workspace model.

## Threat model (explicit)

Forge is a shared `@convex.dev` workspace. The email suffix allowlist in `convex/lib/access.ts` is the tenancy boundary. All allowlisted users are trusted peers with equal access to every installed guild. Wayne is the owner because a single row in `users` needs `role: "owner"` for owner-only operations, but every admin can still read and write the same data.

That design decision scopes this PRD: we are not adding per-user ownership on guilds, forms, or submissions. We are shrinking the blast radius around error leakage, missing fail-closed checks, and env-configurable secrets.

## Findings and disposition

| # | Severity | Finding | Action |
| --- | --- | --- | --- |
| 1 | HIGH | IDOR across forms / submissions / guilds / auditLog / discord actions | No behavior change. Document the shared workspace model in `convex/lib/auth.ts` and the setup guide. Reconsider only if the allowlist widens. |
| 2 | HIGH | Discord API response bodies reflected into `ConvexError.body` | Strip `body` from client errors. Log the payload server-side via `console.error`. Return `{ code, status }`. |
| 3 | MEDIUM | Approve/Deny bypass when `form.modRoleIds` is empty | Fail closed. Require a configured mod role OR Administrator bit via `payload.member.permissions`. |
| 4 | MEDIUM | OAuth install callback reflects `err.message` into redirect URL | Map to opaque codes (`oauth_exchange_failed`, `oauth_register_failed`, `unknown_error`). Log the real error server-side. |
| 5 | MEDIUM | `auditLog.listForForm` returns `metadata: v.any()` including Discord error snippets | Strip known sensitive fields (`body`, `stack`, `error`) from metadata in the query mapper. Keep the `detail` surface the UI already uses. |
| 6 | LOW | CORS `Access-Control-Allow-Origin: *` on interactions OPTIONS | Tighten to the configured `SITE_URL`. Fall back to denying the wildcard. |
| 7 | LOW | Hardcoded `OWNER_EMAIL` in `convex/lib/access.ts` | Move to `OWNER_EMAIL` env var with the current value as default so dev deploys keep working unchanged. |

## Files to change

- `convex/lib/access.ts` — read `OWNER_EMAIL` from `process.env` with existing value as fallback.
- `convex/lib/auth.ts` — add a docstring explaining the shared workspace model so future readers understand why we do not scope by `installedByUserId`.
- `convex/discord.ts` — replace `body: text.slice(0, 500)` in every Discord-facing `ConvexError` with a `console.error` log plus `{ code, status }` only. Four call sites.
- `convex/http.ts` —
  - approve/deny handler: if `modRoles.length === 0`, require Administrator bit via `hasAdministrator(payload.member.permissions)`; reject otherwise.
  - OAuth install callback `catch`: log `err` server-side, redirect with `error=oauth_exchange_failed` (or `oauth_register_failed` when the mutation step fails).
  - tighten the CORS `Access-Control-Allow-Origin` to the configured `SITE_URL` fallback when set, otherwise drop the header entirely (Discord never sends OPTIONS).
- `convex/auditLog.ts` — sanitize `metadata` before returning (strip `body`, `stack`, `error`).
- `docs/setup-guide.md` — document the shared workspace / allowlist model, the new optional `OWNER_EMAIL` env var, and a short "shrink the blast radius" note about the security audit fixes.
- `files.md`, `changelog.md`, `TASK.md` — sync docs.

## Edge cases

- Existing forms with `modRoleIds` unset must still be moderatable by Discord server admins (Administrator bit).
- The existing `corsHeaders` object is shared between `/interactions` and `/api/discord/install`. Both are server-to-server only, so tightening the origin is safe.
- `OWNER_EMAIL` env var missing should not break dev: fall back to `wayne@convex.dev`.
- Audit log sanitization must not hide the `detail` string the UI already displays (that string is derived from metadata at query time).

## Verification steps

1. `npx tsc --noEmit -p convex/tsconfig.json` clean.
2. `npx eslint convex/ src/` clean.
3. Dev deploy: sign in as wayne@convex.dev, confirm role stays `owner`.
4. Dev deploy: unset `OWNER_EMAIL` env var, restart, confirm wayne still gets `owner`.
5. Dev deploy: trigger a Discord API failure (invalid bot token) and confirm the client sees `{ code, status }` without the raw response body, while the server log shows the full payload.
6. Dev deploy: click Approve on a form with `modRoleIds` empty as a non-admin Discord member, confirm rejection. Approve as a server admin (Administrator bit), confirm success.
7. Dev deploy: walk the OAuth install flow with a broken exchange (stale code), confirm the redirect carries `error=oauth_exchange_failed` not the raw message.
8. Dev deploy: open a form's audit log view, confirm error entries render their `detail` string but `metadata` no longer carries `body`.

## Task completion log

- [x] Write PRD
- [x] Fix HIGH #2 — Discord error body sanitization
- [x] Fix MEDIUM #3 — approve/deny fail-closed for empty modRoleIds
- [x] Fix MEDIUM #4 — OAuth redirect opaque error codes
- [x] Fix MEDIUM #5 — auditLog metadata sanitization
- [x] Fix LOW #6 — tighten CORS origin
- [x] Fix LOW #7 — OWNER_EMAIL env var
- [x] Document HIGH #1 threat model in `lib/auth.ts` + setup guide
- [x] Update `docs/setup-guide.md`
- [x] Verify typecheck + lint clean
- [x] Sync `files.md`, `changelog.md`, `TASK.md`
