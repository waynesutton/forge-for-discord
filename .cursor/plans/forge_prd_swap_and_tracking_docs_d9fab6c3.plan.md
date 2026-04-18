---
name: Forge PRD swap and tracking docs
overview: Update the Forge PRD to replace Better Auth with Robelest Convex Auth and Lucide with Phosphor Icons, and explicitly pin hosting to the @convex-dev/static-hosting component. Then create the three project tracking docs (files.md, changelog.md, task.md).
todos:
  - id: update-prd
    content: Rewrite [prds/forge-prd_1.md](prds/forge-prd_1.md) to replace Better Auth with Robelest Convex Auth, Lucide with Phosphor Icons, and pin hosting to @convex-dev/static-hosting across stack line, diagram, tech table, schema, API surface, auth flow, env vars, file structure, phased plan, Cursor prompt, and references
    status: completed
  - id: create-files-md
    content: Create [files.md](files.md) seeded with the PRD section 15 file tree marked as planned, including the new Robel auth and static-hosting Convex files
    status: pending
  - id: create-changelog-md
    content: Create [changelog.md](changelog.md) with a 2026-04-17 entry for PRD v1.1 auth and hosting swap plus tracking doc creation
    status: pending
  - id: create-task-md
    content: Create [task.md](task.md) mirroring PRD phases 1-6 as checkboxes with Phase 1 updated to reflect the Robel auth, static-hosting, and Phosphor icon swap tasks
    status: pending
isProject: false
---

## What changes

Single PRD rewrite plus three new tracking files in the repo root. No code or config yet since this repo still only contains planning docs.

## PRD edits in [prds/forge-prd_1.md](prds/forge-prd_1.md)

1. Header stack line (section top, line 5)
   - Replace `Better Auth (GitHub)` with `Robelest Convex Auth (GitHub OAuth)`
   - Replace `Convex static hosting (frontend)` with `@convex-dev/static-hosting (frontend)`

2. Architecture diagram (section 3)
   - Swap `Better Auth` label for `Robel Convex Auth` in the auth gate box
   - Note static hosting served by `@convex-dev/static-hosting` HTTP routes

3. Tech stack table (section 4)
   - Auth row: `@robelest/convex-auth` + GitHub provider via `OAuth()` factory (per upstream: https://auth.estifanos.com/getting-started/installation/)
   - Icons row: replace `Lucide` with `Phosphor Icons` (`@phosphor-icons/react`, https://phosphoricons.com/)
   - Hosting rows: call out `@convex-dev/static-hosting` package explicitly

4. Data model (section 5)
   - Keep `users` table but reshape to match Robel auth patterns: `subject`, `email`, `name`, `image`, `role`. Identity lookup by `subject` index, not `githubId`
   - Add a short note that the `@robelest/convex-auth` component owns its own tables through `components.auth` and the app-level `users` row mirrors profile data

5. Convex API surface (section 6)
   - HTTP actions: replace `/auth/github/callback` + `/auth/session` with `auth.http.add(http)` registration (OAuth + JWKS handled by the component)
   - Add `convex/auth.ts` exports: `signIn`, `signOut`, `store`

6. Auth flow (section 9)
   - Rewrite to match the Robel auth CLI setup: `convex/convex.config.ts` adds `auth`, `convex/auth.ts` calls `createAuth(components.auth, { providers: [OAuth("github", ...)] })`, client calls `client({ convex, api: api.auth }).signIn("github")`
   - Note the installed-package reality check (PascalCase exports, `OAuth(...)` wrapper for GitHub) per the robel-auth skill

7. Discord Developer Portal and env vars (sections 10 and 11)
   - Replace `BETTER_AUTH_SECRET` with Robel-required env vars: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `JWT_PRIVATE_KEY`, `JWKS` (Robel CLI generates the last two)

8. File structure (section 15)
   - Add `convex/convex.config.ts` with `app.use(auth)` and `app.use(selfHosting)`
   - Add `convex/auth.ts` (Robel auth setup)
   - Add `convex/staticHosting.ts` exposing `generateUploadUrl`, `recordAsset`, `gcOldAssets`, `listAssets`, `getCurrentDeployment`
   - Add `package.json` deploy script: `npx @convex-dev/static-hosting deploy`

9. Phased plan (section 12)
   - Phase 1 swap: run `npx @robelest/convex-auth` setup wizard, run `npx @convex-dev/static-hosting setup`, verify GitHub sign-in and a static deploy before any Discord work

10. References (section 17)
    - Replace Better Auth link with `https://auth.estifanos.com/`
    - Add `https://phosphoricons.com/` and `https://github.com/phosphor-icons/react`
    - Add `https://www.convex.dev/components/static-hosting/static-hosting.md`

11. Cursor prompt (section 16)
    - Update to mention `@robelest/convex-auth`, `@phosphor-icons/react`, and `@convex-dev/static-hosting` instead of Better Auth and Lucide

## New tracking files

- [files.md](files.md): seed with a short intro and the planned file structure from PRD section 15, grouped under `convex/`, `src/`, root. Mark every entry as "planned" until code lands. Includes the three new Convex component entries (`convex/convex.config.ts`, `convex/auth.ts`, `convex/staticHosting.ts`).

- [changelog.md](changelog.md): developer-friendly log, newest-first. Seed entry for today dated 2026-04-17 covering PRD v1.1 changes: Robel Convex Auth, Phosphor Icons, static-hosting component callout, plus creation of `files.md`, `changelog.md`, `task.md`.

- [task.md](task.md): mirror of PRD phases 1-6 as checkboxes, grouped by phase. Each phase keeps the PRD's existing items and adds the three swap tasks up top under Phase 1:
  - Install and configure `@robelest/convex-auth` via CLI wizard
  - Install and configure `@convex-dev/static-hosting` via CLI wizard
  - Swap icon library to `@phosphor-icons/react`

All three docs follow the user rules: no emojis, no em dashes, no banned words.

## Out of scope

No package installs, no code, no Convex config edits. This plan is docs-only. Code work starts once the plan is approved and agent mode is enabled.
