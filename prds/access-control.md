# Access control: @convex.dev email gate

## Problem

Forge launches behind a simple access list. Only Convex employees should be able to sign in, create forms, and touch the approval queue. Everyone else should see an access denied screen after GitHub OAuth. The policy also needs a deterministic owner so workspace-level settings (billing, Discord app credentials, etc.) are never accidentally owned by the wrong person.

## Policy

1. Any GitHub account whose primary verified email ends in `@convex.dev` is allowed.
2. `wayne@convex.dev` is always the workspace owner (`role: "owner"`), regardless of sign-in order.
3. Every other `@convex.dev` user lands as `role: "admin"` and can create forms.
4. Non `@convex.dev` users complete OAuth, get no user row created, and land on `/auth/denied` with a sign-out button.
5. Enforcement lives on the backend. The frontend gate is only for UX.

Email comparison is case-insensitive and uses `.toLowerCase().endsWith("@convex.dev")` so subdomains like `foo.convex.dev` are rejected.

## Solution

### Backend

- Add a pure `isAllowedEmail(email?: string | null)` helper in `convex/lib/access.ts`. Consumed by queries, mutations, and any future Discord actions that need the same gate.
- `convex/users.ts`:
  - New public query `api.users.access`: returns `{ authenticated, allowed, email? }` by reading `ctx.auth.getUserIdentity()`. No DB access, always safe to call.
  - `upsertFromIdentity`: throw `ConvexError("access_denied")` when the email fails the gate. Never writes a row for a denied user.
  - `upsertFromIdentity`: role rule becomes `email === "wayne@convex.dev" ? "owner" : "admin"`. The prior "first user becomes owner" branch is removed.
- `convex/forms.ts`, `convex/submissions.ts`, and any future mutation that creates or mutates forms must call `await requireAdmin(ctx)` which checks both auth and the email gate. Not created in this PR because those files do not exist yet, but `requireAdmin` will live in `convex/lib/access.ts` to land alongside Phase 2.

### Frontend

- `useEnsureAppUser(isAuthenticated)`:
  - Query `api.users.access` first.
  - Only query `api.users.me` and run `upsertFromIdentity` when `access.allowed === true`.
  - Return `{ access, me }`.
- `Protected.tsx`:
  - Unauthenticated → redirect to `/auth/sign-in`.
  - Authenticated + `!access.allowed` → redirect to `/auth/denied` (preserving `Outlet` semantics).
  - Authenticated + allowed + `me === null` → spinner while upsert lands.
- New page `src/pages/AccessDenied.tsx`: PostHog-style window chrome, email echoed back, sign-out button, short note about who to contact.
- Router: add `/auth/denied` above the `<Protected />` group.

### Edge cases

- GitHub account with no verified email → `identity.email` is undefined. `isAllowedEmail` returns false. Denied.
- Email domain contains uppercase (`User@Convex.DEV`) → we lowercase before comparing.
- Subdomain attack (`@foo.convex.dev`) → rejected because we compare the full `@convex.dev` suffix only.
- Existing user row flips from allowed to denied after a rename → `upsertFromIdentity` now throws, so client sees access denied on next sign-in. The stale row stays in place until a future cleanup mutation; acceptable for Phase 1.

### ESLint

The Convex ESLint plugin was just installed. Set up flat config at repo root (`eslint.config.js`) with:

- `convexPlugin.configs.recommended` for the four recommended rules.
- Extra rules `no-collect-in-query` and `import-wrong-runtime` flipped to `warn` so they surface in this file tree.
- `typescript-eslint` type-aware config so `explicit-table-ids` and `no-collect-in-query` actually run.
- `eslint-plugin-react-hooks` recommended rules for the frontend.
- `npm run lint:code` script to run ESLint (existing `lint` stays as `tsc -b --noEmit`).

## Files to change

1. `convex/lib/access.ts` — new. `isAllowedEmail`, `requireAdmin`.
2. `convex/users.ts` — add `access` query, gate `upsertFromIdentity`, deterministic owner.
3. `src/hooks/useEnsureAppUser.ts` — branch on `access.allowed`.
4. `src/components/auth/Protected.tsx` — three-way routing.
5. `src/pages/AccessDenied.tsx` — new page.
6. `src/App.tsx` — register `/auth/denied`.
7. `eslint.config.js` — new. Flat config.
8. `package.json` — add `lint:code` script.
9. `files.md`, `TASK.md`, `changelog.md` — sync trackers.

## Verification steps

1. `npx tsc -b --noEmit` passes.
2. `npm run lint:code` passes (or produces only expected warnings we triage).
3. Manual: sign in with a `@gmail.com` GitHub account → lands on `/auth/denied`, no `users` row created in the dashboard.
4. Manual: sign in with `wayne@convex.dev` → `users` row with `role: "owner"` and dashboard renders.
5. Manual: sign in with another `@convex.dev` account → `users` row with `role: "admin"` and dashboard renders.
6. Convex-doctor checklist: no new security, correctness, or performance regressions (see section below in `changelog.md`).
