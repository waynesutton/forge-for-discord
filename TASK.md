# Tasks

Mirrors `prds/forge-prd_1.md` section 12. Check items off as they ship. Move completed sections to `## Completed` with a date.

## To Do

### Phase 1: Foundations (day 1-2)

- [x] Bootstrap Vite + React 19 + TypeScript + Tailwind v4 project
- [x] Add `package.json` dependencies for Convex, Robel auth, static hosting, Phosphor, dnd-kit, arctic, discord-interactions
- [x] Create `convex/schema.ts` with all six tables from PRD section 5
- [x] Wire `convex/auth.ts` with the `github(...)` provider factory
- [x] Add `convex/staticHosting.ts` exposing upload API + deployment query
- [x] Scaffold `convex/http.ts` with `auth.http.add(http)`, Discord `/interactions` Ed25519 verify + PING, and `registerStaticRoutes`
- [x] Add `me` query and `upsertFromIdentity` mutation in `convex/users.ts`
- [x] Run `npm install` to hydrate `node_modules`
- [x] Run `npx convex dev` to generate `_generated/api.ts` and create a deployment
- [x] Build `src/lib/convex.ts` and `src/lib/auth.ts` singletons
- [x] Build `src/hooks/useAuth.ts` subscribing to `auth.onChange`
- [x] Build `SignIn.tsx` with the GitHub OAuth button
- [x] Build `Protected.tsx` gate for `/app/*` routes backed by `api.users.me`
- [x] Wire `BrowserRouter` in `App.tsx` with `/`, `/auth/sign-in`, `/app`
- [x] Ship placeholder `Dashboard.tsx` at `/app` to prove the round trip
- [x] Enforce `@convex.dev` email allowlist in `upsertFromIdentity` with `wayne@convex.dev` pinned as owner
- [x] Expose `api.users.access` probe query and wire `useEnsureAppUser` + `Protected` to route non-allowlisted users to `/auth/denied`
- [x] Ship `AccessDenied.tsx` page with sign-out affordance
- [x] Install `@convex-dev/eslint-plugin`, `typescript-eslint`, `eslint-plugin-react-hooks`; add `eslint.config.js` and `lint:code` script
- [x] Run convex-doctor static analysis (score: 90 Healthy; remaining warnings triaged in `changelog.md`)
- [x] Fix `@convex.dev` accounts being denied. Root cause: Robel JWTs only carry `sub`; switched `access`/`me`/`upsertFromIdentity` to read email via `auth.user.viewer(ctx)` in `convex/users.ts`.
- [x] Kill the `/auth/denied` refresh storm. Added `src/hooks/useAutoSignOut.ts` so denied sessions call `signOut()` once, and latched the email into `useState` so the message survives the unauthenticated re-render.
- [x] Write `prds/robel-auth-integration-report.md` upstream report covering versions, bug timeline, root causes, patches applied, and recommended fixes for Robel.
- [x] Run `npx @robelest/convex-auth` to generate `JWT_PRIVATE_KEY`, `JWKS`, and the encryption key, then write them to the dev deployment
- [x] Set `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, and `SITE_URL` in Convex env
- [ ] Add shadcn/ui primitives (Button, Input, Select, Dialog) for Phase 2
- [ ] Deploy with `npx @convex-dev/static-hosting deploy` and confirm the Convex site URL resolves

### Phase 2: Discord install + form builder (day 2-3)

- [x] `oauthStates` table for CSRF nonces
- [x] `convex/discord.ts` with `generateInstallUrl` + `exchangeInstallCode`
- [x] `convex/guilds.ts` with `list`, `current`, `registerFromInstall`
- [x] `GET /api/discord/install` HTTP callback (consume nonce → exchange code → register guild → redirect)
- [x] `/app/settings` page with Connect server button, installed guilds list, success/error banners
- [x] Admin disconnect flow for connected Discord servers with guild-scoped cleanup
- [x] Dashboard connected-guild banner (empty and populated states)
- [x] Set `DISCORD_CLIENT_SECRET` in Convex env (`npx convex env list` verified it is present)
- [x] Set `DISCORD_BOT_PERMISSIONS=328565051456` in Convex env and align the code fallback to the same value
- [ ] Add `${CONVEX_SITE_URL}/api/discord/install` as an OAuth2 redirect URI in the Discord developer portal
- [ ] End-to-end test: click Connect → authorize on Discord → land back with `?installed`
- [x] Correct the default Discord permission fallback to `328565051456` so fresh invite links request the full seven-permission set even when `DISCORD_BOT_PERMISSIONS` is unset
- [x] Build `WindowFrame` and `WindowTabs` primitives
- [x] Forms list page with empty state
- [x] New form flow with command name validation (lowercase, unique per guild)
- [x] Form editor route with metadata editing, field CRUD, save flow, and Discord modal preview
- [x] Publish button that registers or updates the Discord guild slash command
- [x] Form editor workspace redesign with toggleable panes and responsive layout
- [x] Add Phosphor powered pane icons and layout controls to the editor toolbar
- [x] Add custom tooltips to editor controls and publish guidance
- [x] Add cached Discord channel sync with per guild refresh and routing defaults
- [x] Extend form editor save flow with routing controls and guild channel pickers
- [x] Add per form results route and submissions view
- [ ] Three-pane builder: fully sortable field list with dnd-kit drag and drop
- [x] Routing panel for mod queue channel, publish destination, and forum tags
- [x] Add cached Discord role sync and role pickers
- [x] Add form restrictions for required roles, blocked roles, lifetime cap, and daily cap
- [x] Add configurable submission success message
- [x] Clarify save vs publish actions in the editor with warnings and tooltips
- [x] Fix editor pane overlap at large widths

### Phase 3: Discord bot core (day 3-4)

- [x] `POST /interactions` httpAction with Ed25519 signature verification
- [x] PING/PONG handling
- [x] `discord.registerCommand` action (POST/PATCH to Discord guild commands endpoint)
- [x] Slash command to modal flow end to end
- [x] Modal submit inserts a Convex `submissions` row
- [x] Auto-publish path when `requiresApproval` is false

### Phase 4: Approval flow (day 4-5)

- [x] Routing panel UI (channel picker, forum tag picker, title source)
- [x] `discord.postToModQueue` with Approve and Deny buttons
- [x] Button interaction routing with mod role check
- [x] Deny reason modal
- [x] `discord.publishSubmission` for text and forum channels
- [x] Forum title templating with `{fieldId}` interpolation

### Phase 5: Polish (day 5-6)

- [ ] Submission inbox page with filters
- [ ] Audit log page
- [ ] Cooldowns enforced on `insertFromDiscord`
- [x] DM submitter on approve and deny
- [x] Hide, unhide, and delete submissions from the dashboard with optional Discord cleanup
- [x] Results page styling pass with status pills, copy to clipboard, and soft-hidden rendering
- [ ] Design refinement pass on every surface
- [ ] Loading skeletons and error states

### Phase 6: Production (day 6-7)

- [ ] Custom domain via Convex
- [ ] Production Discord application separate from dev
- [ ] README with install, env vars, and deploy instructions
- [ ] Rate limit abuse test
- [ ] Signature verify fuzz test

## Completed

### 2026-04-19 01:58 UTC — Keep Discord install callback on the caller's origin

- Root cause of the bug the user reported: `convex/http.ts` built every redirect from `process.env.APP_URL ?? url.origin`. `APP_URL` on the prod Convex deployment was still pinned to the `http://localhost:5173` value from `.env.example`, so a cancelled or completed Discord install on the live `convex.site` host 302d admins to `localhost:5173/app/settings?error=...`.
- Persisted the caller's origin on the nonce row so the callback no longer depends on env. `convex/schema.ts` adds an optional `returnOrigin` column to `oauthStates`. `convex/oauthStates.ts` accepts `returnOrigin` on `create` and returns it on `consume` (validator widened to `v.union(v.string(), v.null())` on the consume return shape).
- `convex/discord.ts` adds a `returnOrigin: v.optional(v.string())` arg on `generateInstallUrl` plus a new `sanitizeReturnOrigin` helper. The helper parses with `new URL(...)`, rejects anything that is not `http:` or `https:`, and returns only `URL.origin` so no paths, queries, or fragments get persisted.
- `convex/http.ts` now consumes the state first (even on the `?error=access_denied` branch) so every redirect target uses `nonce.returnOrigin ?? APP_URL ?? url.origin`. `APP_URL` stays as a soft fallback; it is no longer a single point of failure.
- `src/pages/Settings.tsx` calls `generateInstallUrl({ returnOrigin: window.location.origin })` on the Connect server click.
- User also fixed `APP_URL` and `SITE_URL` on the prod Convex deployment in the same session, so the belt-and-suspenders fallback path is no longer being exercised.
- Verified with `npx tsc --noEmit`, `npx tsc --noEmit -p convex/tsconfig.json`, and `ReadLints` on `convex/discord.ts`, `convex/http.ts`, `convex/oauthStates.ts`, `convex/schema.ts`, `src/pages/Settings.tsx`. All clean.
- Files touched: `convex/schema.ts`, `convex/oauthStates.ts`, `convex/discord.ts`, `convex/http.ts`, `src/pages/Settings.tsx`, `changelog.md`, `files.md`, `TASK.md`.

### 2026-04-19 01:09 UTC — Tighten global border-radius to 0.25rem

- Updated `--radius-window` in `src/styles/index.css` from `12px` to `0.25rem` (4px). Single-token edit cascades to the 70+ `rounded-[var(--radius-window)]` usages across Dashboard, Forms, Settings, Docs, SignIn, AccessDenied, NewForm, EditForm, FormLogs, FormResults, WindowFrame, and WindowTabs so every card, dropdown, button, and alert shares one crisp, technical edge.
- Normalized `src/pages/About.tsx` in the same pass: five `rounded-[20px]` figure and aside boxes (InternalAppNotice plus four product mockups) and six pill-shaped CTAs (hero trio plus closing trio plus GitHub eyebrow pill) now use the shared token. Intentional circles kept as `rounded-full` (Mac window dots, icon badges, step numbers, avatars, social icon buttons).
- Normalized stray values: two `rounded-md` inline code chips in `src/pages/Docs.tsx`, the `rounded-xl` tooltip in `src/components/ui/Tooltip.tsx`, and two `rounded-[6px]/[8px]` drag-handle chips in `src/pages/EditForm.tsx` all migrated to `rounded-[var(--radius-window)]`.
- Verified with `ReadLints` on every edited file (clean) and a repo-wide grep for `rounded-(sm|md|lg|xl|2xl|3xl)` and hard-coded pixel radii on boxes that returns zero matches.
- Files touched: `src/styles/index.css`, `src/pages/About.tsx`, `src/pages/Docs.tsx`, `src/pages/EditForm.tsx`, `src/components/ui/Tooltip.tsx`, `files.md`, `changelog.md`, `TASK.md`.

### 2026-04-18 — Scrub @convex.dev and owner email out of docs

- Removed the hardcoded Convex email domain (`@convex.dev`) and the upstream owner email (`wayne@convex.dev`) from every public doc surface so the hosted instance's team domain and owner inbox never ship in a fork.
- `docs/setup-guide.md`: hosted-instance heads-up note (line 7) now says "locked to a single email domain the admin configures". The `OWNER_EMAIL` paragraph (line 302) points readers at the compile-time fallback in `convex/lib/access.ts` instead of naming the email. Allowlist helper description (line 327) now reads "a single email-suffix domain the admin configures, set via `ALLOWED_EMAIL_SUFFIX`".
- `docs/discord-setup.md`: step 3 under "Install the bot into your server" now says "Your account email must match the allowlist domain the admin configures in `convex/lib/access.ts`".
- `src/pages/Docs.tsx`: mirrored the same three edits inside the in-app docs markdown strings so the public `/docs` page and the on-disk guide stay in sync.
- Verified with `ReadLints` (clean) and a repeat `Grep` across `docs/` and `src/pages/Docs.tsx` that returns zero matches for either string.
- Files touched: `docs/setup-guide.md`, `docs/discord-setup.md`, `src/pages/Docs.tsx`, `files.md`, `changelog.md`, `TASK.md`.

### 2026-04-18 — Mark hosted Forge as internal Convex app

- Removed every "sign in" CTA from `src/pages/About.tsx` (hero "Sign in with GitHub" + closing "Sign in to Forge") and added an `InternalAppNotice` card in the hero explaining that sign in on the hosted deployment is locked to `@convex.dev` emails and pointing visitors at the fork + docs path. Primary CTA is now "Fork the repo" (deep-links to `/fork`), backed by the setup guide and the Convex community.
- Added a `Colophon` section at the bottom of `/about`: "Created by Wayne with Convex, Cursor, and Claude Opus 4.7. Connect on Twitter/X, LinkedIn, and GitHub." plus "This project is licensed under the Apache License 2.0." with linked Phosphor social pills for X, LinkedIn, GitHub, and the Convex community Discord.
- Wired the Stack section links to `convex.dev` (Backend) and `convex.dev/components/static-hosting` (Hosting). Centralised every external URL at the top of `About.tsx`.
- Updated the sign-in footer in `src/components/auth/SignIn.tsx`: attribution now reads "For Discord servers built with Convex." and the right side is a three-icon row pointing at `/docs`, the public repo, and the Convex community Discord so visitors who cannot sign in still have three ways to explore the project.
- Added an internal-app callout paragraph to `docs/setup-guide.md` (right after the opening intro) and to the overview section of `src/pages/Docs.tsx` so the in-app and on-disk docs both state the hosted instance is Convex-team only and the reader should fork + self host.
- Files touched: `src/pages/About.tsx`, `src/components/auth/SignIn.tsx`, `docs/setup-guide.md`, `src/pages/Docs.tsx`, `files.md`, `changelog.md`, `TASK.md`.
- Verification: `npx tsc --noEmit -p tsconfig.app.json` clean. `ReadLints` on the edited files clean.

### 2026-04-18 — Static hosting deploy fix (generateUploadUrls)

- `npx @convex-dev/static-hosting deploy` was failing on the upload step with "Could not find function for 'staticHosting:generateUploadUrls'". The 0.1.3 CLI calls the batched plural functions (`generateUploadUrls`, `recordAssets`) but `convex/staticHosting.ts` was still using the old README snippet that only destructured four singular functions.
- Updated `convex/staticHosting.ts` to destructure all six functions `exposeUploadApi` returns: `generateUploadUrl`, `generateUploadUrls`, `recordAsset`, `recordAssets`, `gcOldAssets`, `listAssets`.
- Verified by reading `node_modules/@convex-dev/static-hosting/dist/cli/upload.js:175` (calls `${componentName}:generateUploadUrls`) and `dist/client/index.js:371` (batched helpers exist in the factory). `ReadLints` on the edited file was clean.
- Files touched: `convex/staticHosting.ts`, `changelog.md`, `files.md`, `TASK.md`.

### 2026-04-18 — Public /about marketing page

- Added `src/pages/About.tsx` as a paper.design inspired editorial landing page. No header, no footer. Huge display type, stacked sections, four large SVG product mockups in `public/about/` (`builder.svg`, `queue.svg`, `ticket.svg`, `results.svg`). Full feature list grouped by Build, Publish, Moderate, Ticket mode, Review, Observe. Stack table plus closing CTA.
- Wired `/about` into `src/App.tsx`.
- Added the About link on the homepage only, inline next to "For Convex by Convex." in `src/components/auth/SignIn.tsx`. No other surface links to About.
- Verified with `npx tsc --noEmit -p tsconfig.app.json` and `ReadLints`. Both clean.
- Files touched: `src/pages/About.tsx` (new), `public/about/builder.svg` (new), `public/about/queue.svg` (new), `public/about/ticket.svg` (new), `public/about/results.svg` (new), `src/App.tsx`, `src/components/auth/SignIn.tsx`, `files.md`, `changelog.md`, `TASK.md`.

### 2026-04-18 — /about SVG fix + open source links

- Replaced the HTML-only entities `&middot;`, `&hellip;`, `&rarr;` with Unicode characters inside `public/about/builder.svg`, `public/about/queue.svg`, `public/about/ticket.svg`, and `public/about/results.svg`. SVG is strict XML so browsers were refusing to parse the files, which is why the hero builder image rendered as a broken icon with just the alt text. Verified with `xmllint --noout`.
- Added open source messaging plus links to `https://github.com/waynesutton?tab=repositories` and `https://phosphoricons.com/` across `src/pages/About.tsx`: hero "Open source on GitHub" pill, hero "View the repo" CTA, intro paragraph GitHub line, linked Phosphor Icons row and new "Source" row in the stack table, and a "Star it on GitHub" button in the closing CTA.
- Verification: `ReadLints` on `src/pages/About.tsx` clean.
- Files touched: `public/about/builder.svg`, `public/about/queue.svg`, `public/about/ticket.svg`, `public/about/results.svg`, `src/pages/About.tsx`, `changelog.md`, `TASK.md`.

### 2026-04-18 23:20 UTC — Docs: OWNER_EMAIL commands in every setup block

- Added `npx convex env set OWNER_EMAIL you@yourdomain.com` and the `--prod` variant to every copy-paste command block in the setup docs so anyone forking Forge sees the command where they are already running `npx convex env set`, not just mentioned inline.
- `docs/setup-guide.md`: added to "Set the rest of the auth env on Convex" (dev), the matching prod block, "Set the same keys on prod with --prod" under the env var reference table, and step 5 of "Go from localhost to production".
- `src/pages/Docs.tsx`: same additions in the in-app `/docs` markdown. "Admin access and how to add admins" now shows both commands inline. Added a new `OWNER_EMAIL` row to the Environment variables reference table and a "Tenancy model" callout pointing at `prds/security-audit-fixes-2026-04-18.md`.
- Verification: `npx tsc --noEmit -p tsconfig.app.json` and `npx eslint src/pages/Docs.tsx` clean.
- Files touched: `docs/setup-guide.md`, `src/pages/Docs.tsx`, `changelog.md`, `files.md`, `TASK.md`.

### 2026-04-18 22:53 UTC — Security audit fixes (HIGH / MEDIUM / LOW)

- PRD: `prds/security-audit-fixes-2026-04-18.md`
- HIGH #2: `convex/discord.ts` — stripped Discord API response bodies from all four `ConvexError` throws. Server logs the body via `console.error`, client gets `{ code, status }` only. UI copy unchanged.
- MEDIUM #3: `convex/http.ts` — approve / deny buttons now fail closed when `form.modRoleIds` is empty, requiring the Discord Administrator permission bit. When mod roles are set, the caller must carry one OR be a server admin.
- MEDIUM #4: `convex/http.ts` — OAuth install callback redirects with stable opaque codes (`oauth_exchange_failed`, `oauth_register_failed`). Real error logged server-side. `src/pages/Settings.tsx` got two new friendly `errorMessage` cases.
- MEDIUM #5: `convex/auditLog.ts` — added `sanitizeMetadata` that strips `body`, `response`, `responseBody`, `stack`, `error`, `rawError`, `raw` from the returned metadata object while preserving the `detail` string the UI shows.
- LOW #6: `convex/http.ts` — dropped the `Access-Control-Allow-Origin: *` wildcard. `buildCorsHeaders()` now pins the origin to `process.env.SITE_URL` when set and omits the header otherwise. No browser ever hits these routes.
- LOW #7: `convex/lib/access.ts` — owner email now reads from `process.env.OWNER_EMAIL` with `wayne@convex.dev` as the fallback. `.env.example` documents the new variable.
- HIGH #1 (IDOR): no behavior change. Documented the intentional shared workspace tenancy model in `convex/lib/auth.ts` and `docs/setup-guide.md`. Follow-up noted in the PRD for when the allowlist widens.
- `docs/setup-guide.md` — rewrote the "Admin access" section to cover the env-var owner, added a "Tenancy model and who can see what" subsection, and added `OWNER_EMAIL` to the Convex env table.
- Verification: `npx tsc --noEmit -p convex/tsconfig.json`, `npx tsc --noEmit -p tsconfig.app.json`, `npx eslint convex/ src/` all clean.
- Files touched: `convex/discord.ts`, `convex/http.ts`, `convex/auditLog.ts`, `convex/lib/access.ts`, `convex/lib/auth.ts`, `src/pages/Settings.tsx`, `.env.example`, `docs/setup-guide.md`, `prds/security-audit-fixes-2026-04-18.md`, `changelog.md`, `files.md`, `TASK.md`.

### 2026-04-18 — Gitignore cleanup for AI configs + Convex security audit

- Added `.cursor/`, `.claude/`, `.agents/`, `.codex/`, `.gemini/` to `.gitignore` so local AI assistant configs and skill caches stop shipping to GitHub.
- Ran `git rm -r --cached .cursor .claude .agents` to untrack 160 previously committed files. Files remain on disk. Changes are staged, not committed, not pushed. Files still live in git history; noted that a `git filter-repo` rewrite is needed to scrub history if required.
- Ran a full security audit of `convex/` following `.claude/skills/sec-check/SKILL.md`. No pre-auth exploits. Controls verified: Discord `/interactions` Ed25519 verify, OAuth state single-use with expiry, `botToken` stripped from public guild queries, `stripSecrets` in `guilds.ts`, no hardcoded secrets in `src/` or `.env.example`.
- Findings logged to `changelog.md` under `## [Unreleased] > Security`:
  - HIGH: IDOR across `forms.get`/`update`, `submissions.listForForm`/`setHidden`/`deleteSubmission`/`decide`/`postReply`, `guilds.updateRoutingDefaults`/`disconnect`/`listChannels`/`listRoles`, `auditLog.listForForm`, and every action in `convex/discord.ts`. Gated handlers only call `requireAllowedUser` / `requireAllowedWorkspaceUser` (email-suffix allowlist) and never check the caller against `guilds.installedByUserId` or a membership rule.
  - HIGH: `convex/discord.ts` leaks Discord API response bodies (500 chars) into `ConvexError.body`, which reaches the browser.
  - MEDIUM: `convex/http.ts:207-213` approve/deny allows anyone when `form.modRoleIds` is empty. Needs fail-closed semantics.
  - MEDIUM: `convex/http.ts:497-502` reflects `err.message` into the OAuth install redirect URL.
  - MEDIUM: `convex/auditLog.ts:25` returns `metadata: v.any()` without redacting Discord error snippets.
  - LOW: CORS `*` on the interactions OPTIONS handler (`convex/http.ts:513-534`); fine for Discord server-to-server, tighten if a browser origin ever needs it.
  - LOW: hardcoded `OWNER_EMAIL` and `@convex.dev` suffix in `convex/lib/access.ts`; move to env if the allowlist ever changes.
- No application code changed in this session. Fixes deferred so each can land with focused tests.
- Files touched: `.gitignore`, `changelog.md`, `files.md`, `TASK.md`.

### 2026-04-18 — Logout race fix, public docs, localhost to production guide

- Fixed admins getting flashed to `/auth/denied` on sign-out. Root cause: `signOutNow()` clears the Convex auth token synchronously via `convex.clearAuth?.()`, but the Robel auth client's `onChange` (and therefore `isAuthenticated`) only flips after the async `auth.signOut()` round-trip. During that window, `api.users.access` refetches unauthenticated and returns `{ authenticated: false, allowed: false }`, and `src/components/auth/Protected.tsx` hit its `!access.allowed` branch before `!isAuthenticated`.
- Fix: `Protected` now checks `access.authenticated` first and routes those sessions to `/`; `/auth/denied` is reserved for real authenticated-but-not-allowlisted cases. `src/pages/Dashboard.tsx` also calls `navigate("/", { replace: true })` before awaiting `signOut()` so the `/app` subtree unmounts before any in-flight access query resolves with the cleared auth token.
- Made docs reachable without signing in. `src/App.tsx` moved `/docs` and `/docs/:slug` out from under `Protected`; `/app/docs` and `/app/docs/:slug` redirect to `/docs` for back-compat.
- `src/pages/Docs.tsx` now reads the `Protected` outlet via `useOutletContext` (returns `undefined` on the public route). Logged-out visitors see the same content without the Settings button or Forms/Docs/Settings tabs, the back button routes to `/`, and a Sign in CTA appears in the top right.
- `src/components/auth/SignIn.tsx` gained a "Read the setup guide" link under the Continue with GitHub button so anyone evaluating Forge can read the docs from the homepage.
- Dashboard and Forms navigation now link to `/docs`.
- Added a new "Go from localhost to production" section (slug `localhost-to-production`) to both `docs/setup-guide.md` and `src/pages/Docs.tsx`. Eight-step checklist: prove the flow on dev, create a separate Convex prod project via `npx convex init --prod`, create a second Discord application, create a second GitHub OAuth app, set every prod env var via `npx convex env set --prod`, `npm run deploy`, smoke test in incognito, rotate secrets safely.
- Dropped hardcoded `honorable-mammoth-130.convex.site` and `usable-kiwi-349.convex.site` URLs from the docs. Everywhere now reads as `<your dev convex site url>` / `<your prod convex site url>` with shape `https://<animal-name-1234>.convex.site`, matching the style used on https://www.convex.dev/components/static-hosting.
- Verified with `npx tsc --noEmit -p tsconfig.app.json` and `npx eslint src/`. Both clean.
- Files touched: `src/App.tsx`, `src/components/auth/Protected.tsx`, `src/components/auth/SignIn.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Docs.tsx`, `src/pages/Forms.tsx`, `docs/setup-guide.md`, `changelog.md`, `files.md`, `TASK.md`.

### 2026-04-18 — App-wide UI polish, font loading, copy clarity

- Preloaded Inter (400/500/600/700) and JetBrains Mono (400/500) from Google Fonts in `index.html` with matching `preconnect` hints so the primary UI font no longer falls back to system-ui on first paint.
- Repointed `--font-sans` in `src/styles/index.css` to lead with Inter, kept Matter and system-ui as fallbacks, turned on Inter OpenType features (`ss01`, `cv11`, `cv02`) plus antialiasing, and tightened heading letter-spacing so Inter matches the window chrome aesthetic.
- Softened the workspace background gradient (dropped the radial stops from 8 to 6 percent accent mix) so the hero feels quieter and avoids the AI-slop "ambient glow" pattern called out in the anti-vibe-code skill.
- Added a global `:focus-visible` outline pulled from the ink token so keyboard focus reads consistently on inputs, buttons, links, and any `[tabindex]` element without the default browser blue ring.
- Honored `prefers-reduced-motion: reduce` by shortening animations and transitions to 0.001ms for opted-in users.
- Clarity pass on copy across `src/components/auth/SignIn.tsx`, `src/pages/AccessDenied.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Forms.tsx`, `src/pages/NewForm.tsx`, and `src/pages/Settings.tsx`. Rewrote subtitles, empty states, helper text, confirmation language ("can't be undone"), and every `formatCreateError`, `errorMessage`, and `formatDisconnectError` branch so each error tells the admin what to do next. Pending button labels now append an ellipsis ("Opening GitHub...", "Signing out...", "Disconnecting...") so they read as in-progress rather than a second verb.
- Added `role="status"` and `aria-live="polite"` to the Forms loading state so screen readers announce "Loading server" instead of silent spin.
- Ran the anti-vibe-code grep audit (`backdrop-blur-xl`, `group-hover:scale`, `animate-hero-glow`, `animate-fade-up`, `bg-*/N flex items-center justify-center`). All zero matches across `src/`.
- Verified with `ReadLints` on every touched file. No linter errors.
- Files touched: `index.html`, `src/styles/index.css`, `src/components/auth/SignIn.tsx`, `src/pages/AccessDenied.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Forms.tsx`, `src/pages/NewForm.tsx`, `src/pages/Settings.tsx`, `files.md`, `changelog.md`, `TASK.md`.

### 2026-04-18 — Marketing copy, SEO metadata, favicon, auth screen polish

- Added a developer marketing intro to `README.md` describing who Forge is for, what it replaces, and the Convex-only deployment tradeoffs.
- Rewrote `index.html` with full SEO metadata: `<title>`, rich description, keywords, `theme-color`, Open Graph tags, Twitter summary card, `robots`, SVG favicon link, and an Apple touch icon fallback.
- Created `public/favicon.svg`. Rounded beige square with 1px border and an orange lightning bolt (`#f54e00`) that matches the in-app Lightning icon.
- Simplified the `/auth/denied` copy in `src/pages/AccessDenied.tsx`. Removed the primary-email paragraph; the screen now reads a single line: "Forge is limited to Convex team accounts."
- Replaced the terms of use footnote on `/auth/sign-in` with "For Convex by Convex." to reflect that the app is internal tooling.
- Top-aligned the sign-in layout so the card sits above the fold on a laptop. Added an "Inside Forge" feature grid under the card with eight Phosphor icon rows (form builder, slash commands, mod queue, ticket mode, audit log, CSV and PDF export, private fields, reply from dashboard). Kept the existing window-chrome style and accent color.
- Updated `files.md` rows for `README.md`, `index.html`, `public/favicon.svg`, `src/components/auth/SignIn.tsx`, and `src/pages/AccessDenied.tsx` to match the changes.
- Verified with `npx tsc --noEmit -p tsconfig.app.json` (clean) and `ReadLints` on every touched file (clean).

### 2026-04-18 — README and brand scrub

- Wrote `README.md` with what Forge does, feature list, stack, getting started, scripts, access model, and links to `prds/forge-prd_1.md`, `files.md`, `changelog.md`, `TASK.md`, and `docs/discord-setup.md`.
- Removed third-party brand references from design tokens and docs. Touched `src/styles/index.css`, `files.md`, `TASK.md`, `prds/forge-prd_1.md`, and `prds/access-control.md`.
- Flipped the `README.md` row in `files.md` from `planned` to `live`.

### 2026-04-18 — Ticket mode role gates

- Added per-form Claim role and Resolve role pickers under the Ticket mode panel in `src/pages/EditForm.tsx`. Admins set which roles can press each button beyond the built-in admin + mod gate.
- Schema: `forms.ticketClaimRoleIds` and `forms.ticketResolveRoleIds` (optional arrays). Normalized and validated against cached guild roles in `convex/forms.ts:update`.
- `convex/submissions.ts:routeContext` surfaces both role lists on `form` so the Discord path can gate buttons per action.
- `convex/http.ts:handleTicketButton` replaces the old single mod-role check with a per-action evaluator. Claim: admin or mod or claim role. Resolve: admin or mod or resolve role or submitter. Close: admin or mod or submitter. Reopen: admin or mod. Unclaim: admin or mod or current assignee (mutation still enforces `not_assignee`). Added `hasAdministratorPermission` (reads Discord's bit 0x8 from `member.permissions`) and `ticketActionDenial` helpers.
- Verified with `npx tsc --noEmit` and `npm run lint:code`.

### 2026-04-18 — Form activity logs, email privacy, Discord error hints

- Added a simple logs viewer at `/app/forms/:formId/logs` so admins can diagnose why a submission never landed in Discord without digging through Convex console logs.
- Backend: new `convex/auditLog.ts:listForForm` query reads the last 300 `auditLog` rows for a form, classifies each row as `info` or `error` from an allow-list of failure actions, and joins submitter names from `submissions`. Added `submission_created`, `mod_queue_posted`, and `submission_published` audit writes in `convex/submissions.ts` so the log shows successes, not just the existing `logRoutingSkip` failure rows.
- Frontend: `src/pages/FormLogs.tsx` renders a WindowFrame table with Time, Event, By, Status, and Summary columns. Rows expand inline to show structured metadata and a Copy button for the error detail. A filter toggles All vs Errors only. Logs button lives in the `WindowFrame` header next to Results on `src/pages/EditForm.tsx` and `src/pages/FormResults.tsx`. Route wired in `src/App.tsx`.
- Fixed email fields leaking into published Discord destination posts. Added `audience` parameter to `buildSubmissionEmbed` in `convex/discord.ts` plus an `isPrivateFieldType` allow-list so `publishSubmissionImpl` and `updatePublishedTicketMessage` strip email fields from public embeds while the mod queue and dashboard keep showing them.
- Translated Discord REST error codes on the logs page. `src/pages/FormLogs.tsx` now parses the `<status>:<body>` detail, pulls the numeric `code`, and rewrites the row summary with a plain English fix for `10003`, `50001`, `50013`, `50035`, and `160002`. Raw JSON stays in the expand panel.
- Removed duplicate Logs and Results buttons from the Editor workspace card in `src/pages/EditForm.tsx` so the card focuses on Save draft and Update Discord command.
- Verified with `npx tsc --noEmit -p convex/tsconfig.json`, `npx tsc --noEmit -p tsconfig.app.json`, and `npm run lint:code`.

### 2026-04-18 — Ticket mode, number fields, and dashboard reply

- Added `prds/ticket-mode-and-number-fields.md` to scope the support request and bounty request workflows before touching code.
- Schema: added `forms.ticketMode`, `forms.autoCloseInactiveDays`, and per-field `minValue`, `maxValue`, `currencyUnit` plus a new `number` type. Added `submissions.ticketStatus`, `assignedToUserId`, `assignedToUserName`, `assignedAt`, `lastActivityAt`, and a `by_ticketstatus_and_lastactivityat` index. Everything is optional so existing forms render unchanged.
- Backend: extended `convex/forms.ts` (validators, update args, `normalizeFields`, `normalizeAutoCloseDays`, `normalizeNumberFieldBounds`, `toEditableForm`) and `convex/submissions.ts` (ticket initialization in `insertFromDiscord`, number-branch in `validateAndSanitize`, enriched `routeContext`, `listForForm` row shape, new `recordTicketAction`/`applyTicketAction`, `sweepAutoCloseTickets`, `postReply`).
- Discord: added `buildTicketComponents`, `buildTicketFooter`, `updatePublishedTicketMessage`, `archiveForumThread`, and `postReplyToSubmission` in `convex/discord.ts`. `publishSubmissionImpl` now attaches the ticket row and status-aware footer when ticket mode is on.
- HTTP: added `ticket:*:<submissionId>` handling to the MESSAGE_COMPONENT branch in `convex/http.ts` with a `parseTicketCustomId` allow-list, mod role gate, and friendly reason-code messages.
- Cron: created `convex/crons.ts` with an hourly `sweepAutoCloseTickets` run so inactive tickets close, archive forum threads, and refresh the published message automatically.
- Frontend: added number field bounds and currency unit inputs, Hash icon, ticket mode toggle, and auto-close days input to `src/pages/EditForm.tsx`. `src/pages/FormResults.tsx` now renders a ticket summary row and a collapsed "Reply in Discord" composer on published submissions. `src/pages/FormResults.tsx` and `src/lib/exportResults.ts` format numeric values with `Intl.NumberFormat` plus the configured unit.
- Verified with `npx tsc --noEmit -p convex/tsconfig.json` and `npx tsc --noEmit -p tsconfig.app.json`.

### 2026-04-18 — Link submitter handle on publish

- Added `linkSubmitterOnPublish` flag to the `forms` table (`convex/schema.ts`), editable validator, update args, patch, and `toEditableForm` return in `convex/forms.ts`, and routed it through `routeContext` in `convex/submissions.ts`.
- `publishSubmissionImpl` in `convex/discord.ts` now prepends `Submitted by <@submitterId>` to both text-channel and forum-thread posts when the flag is on, with `allowed_mentions.parse = []` so the handle renders as a clickable pill without pinging anyone. Works for both approved submissions and auto-published submissions when `requiresApproval` is off.
- Added a "Link submitter on publish" toggle in `src/pages/EditForm.tsx` Command settings under the moderator footer toggle.
- Verified with `npx tsc --noEmit`, `npx tsc --noEmit -p convex/tsconfig.json`, and `npm run lint:code`.

### 2026-04-18 — Optional moderator name in Discord footer

- Added `showModeratorInFooter` to the `forms` table in `convex/schema.ts` and plumbed it through `editableFormValidator`, `update` args, the patch, and `toEditableForm` in `convex/forms.ts`. Undefined defaults to true so every existing form keeps today's "Approved by {name}" footer.
- Exposed the flag on the shared `routeContext` in `convex/submissions.ts` and taught `buildSubmissionEmbed` in `convex/discord.ts` to collapse the footer to "Approved" or "Denied" when the form turns it off. The results dashboard still records and shows the moderator since that view is admin only.
- Added a "Show moderator name on Discord" toggle in the Command settings pane of `src/pages/EditForm.tsx` with a tooltip explaining the trade off, plus snapshot, saveDraft, and reload wiring.
- Verified with `npx tsc --noEmit`, `npx tsc --noEmit -p convex/tsconfig.json`, and `npm run lint:code`.

### 2026-04-18 — Dashboard approve and deny plus results quick link

- Added `api.submissions.decide` public mutation in `convex/submissions.ts` that shares an `applyDecision` helper with the existing `internal.submissions.recordDecision` so the transition, audit row, publish, mod queue embed edit, and submitter DM all stay identical to the Discord button path. Helper avoids `ctx.runMutation`, which re-evaluated `convex/auth.ts` in a fresh isolate without `CONVEX_SITE_URL` and threw. Uses the signed-in admin's name and email as the moderator identity, validates the deny reason length, and surfaces `submission_not_found` and `already handled` states to the UI.
- Surfaced Approve and Deny buttons on pending rows in `src/pages/FormResults.tsx` when the form requires approval. Added a `DenySubmissionDialog` that requires a trimmed reason (max 500 chars), a new `primary` variant on `RowAction`, and friendlier error mapping for `deny_reason_required`, `deny_reason_too_long`, and `access_denied`.
- Added a Results quick link to the form editor header in `src/pages/EditForm.tsx` via the `WindowFrame` action slot, mirroring the "Back to editor" pattern on the results page.
- Verified with `npx tsc --noEmit`, `npx tsc --noEmit -p convex/tsconfig.json`, and `npm run lint:code`.

### 2026-04-18 — Expanded modal field types and editor polish

- Added `prds/field-types-and-editor-polish.md` to plan new modal field types, sanitization, code blocks, moderator roles, and editor UX before touching code.
- Extended the schema and validators: `convex/schema.ts` and `convex/forms.ts` now accept `email`, `code`, `select`, `yes_no`, and `checkbox` field types with optional `helperText` and `options`, plus per type validation in `normalizeFields` / `normalizeFieldOptions`. `forms.update` now accepts `modRoleIds`.
- Added server side sanitization and validation in `convex/submissions.ts` via `validateAndSanitize`, which strips HTML, zero-width chars, and null bytes, enforces length, checks basic email format, and verifies option ids before write. `routeContext` now carries field options for downstream embed rendering.
- Rebuilt the Discord modal builder in `convex/http.ts`. Classic `ACTION_ROW + TEXT_INPUT` stays the default when every field is text-like; any option-based field switches the whole modal to Label-wrapped (`type: 18`) components with `STRING_SELECT` for single-choice fields. `collectModalValues` now walks the nested modal payload to pull both `value` and `values[0]`.
- Updated Discord embed rendering in `convex/discord.ts`. `formatFieldValue` resolves option ids back to labels and wraps `code` answers in triple-backtick blocks with backtick escape so mod queue and destination embeds render cleanly.
- Polished the form editor in `src/pages/EditForm.tsx`: new `FieldTypePicker` dropdown, dedicated `FieldEditor` (label, helper text, required, placeholder, min/max, options editor for dropdown, single-option editor for confirmations), pencil icon affordance on each field row, Moderator roles picker that appears when approval is required, and a bottom-of-pane Save draft plus Update Discord command button pair for Command settings with an Unsaved changes marker.
- Surfaced code blocks and option labels on the dashboard in `src/pages/FormResults.tsx` and `src/lib/exportResults.ts`. Results list now renders `code` answers inside a scrollable `<pre><code>` with a copy button and shows option labels for select, yes_no, and checkbox fields. CSV and PDF exports resolve option ids to labels.
- Verified with `npx tsc --build --force` (clean) and `ReadLints` (clean).

### 2026-04-18 — Submission moderation and results styling

- Added `prds/submission-moderation-and-styling.md` covering hide, delete, optional Discord cleanup, and the results page styling pass before any code moved.
- Added `submissions.hiddenAt` to `convex/schema.ts` and extended `convex/submissions.ts` with `setHidden`, `deleteSubmission`, an `includeHidden` arg on `listForForm`, and new `hasModQueueMessage` plus `hasPublishedMessage` flags on the row validator.
- Added `internal.discord.deleteDiscordMessages` in `convex/discord.ts` plus `internal.guilds.getBotTokenForDelete` and `internal.guilds.logDiscordDeleteSkip` in `convex/guilds.ts` so opt-in cleanup can DELETE the mod queue and destination messages via Discord REST.
- Rewrote `src/pages/FormResults.tsx` with a Show hidden toggle, per row Hide and Delete buttons, a delete confirm dialog with an "Also remove from Discord" checkbox (defaulting off), status pills, a copy icon per field value, readable timestamps including decided-at, a hidden badge plus dashed outline for soft-hidden rows, and a friendly empty state for the hidden-only case.
- Verified with `npx convex codegen`, `npx tsc --noEmit`, `npm run lint:code`.

### 2026-04-18 — Phase 3 mod queue and approvals

- Added `prds/phase-3-mod-queue.md` to plan submission routing, the review embed with Approve and Deny buttons, deny reason modal, destination publish for text and forum channels, and submitter DMs before touching code.
- Extended `convex/submissions.ts` with `routeContext`, `recordDecision`, `markModQueuePosted`, `markPublished`, and `logRoutingSkip` so the Discord actions have one place to read routing data and write back decisions and audit rows.
- Added `routeSubmission`, `postToModQueue`, `updateModQueueMessage`, `publishSubmission`, and `sendDecisionDM` in `convex/discord.ts`, plus shared helpers for the submission embed, review buttons, forum title interpolation, and Discord markdown escape.
- Extended `convex/http.ts` with a MESSAGE_COMPONENT branch that enforces `modRoleIds`, records approvals, and opens the deny reason modal, and a MODAL_SUBMIT branch that records denials with the reason.
- Verified with `npx tsc --noEmit` and `npm run lint:code`.

### 2026-04-18 — Form guards and editor clarity

- Added `prds/form-guards-and-editor-clarity.md` before implementation to cover role cache, role gates, submission caps, success messages, and the overlapping editor layout bug.
- Extended `convex/schema.ts`, `convex/guilds.ts`, `convex/forms.ts`, `convex/submissions.ts`, `convex/discord.ts`, and `convex/http.ts` with cached guild roles, form guard settings, submit-time enforcement, and Discord-facing error messages.
- Extended `src/pages/EditForm.tsx` with required and blocked role pickers, lifetime and daily caps, success message editing, role refresh, clearer save vs Discord sync messaging, extra tooltips, and pane width fixes.
- Widened the new `submissions.submittedAt` field to optional so existing dev data keeps validating while new submissions still store the timestamp needed for daily limits.
- Verified with `npx convex codegen`, `npx tsc --noEmit`, `npm run lint:code`, IDE lint checks, and a sanity read of the active Convex and Vite terminals.

### 2026-04-18 — Form results and routing

- Added `prds/form-results-and-routing.md` to define the results view, guild channel cache, settings defaults, and editor routing scope before implementation.
- Extended `convex/schema.ts`, `convex/guilds.ts`, `convex/forms.ts`, `convex/discord.ts`, and `convex/submissions.ts` with cached guild channels, per guild routing defaults, form routing persistence, channel refresh, and per form submission reads.
- Added `/app/forms/:formId/results` through `src/pages/FormResults.tsx`, plus direct Results links from the forms list and editor.
- Expanded `src/pages/Settings.tsx` so each connected server can refresh channels and save default approval and destination channels.
- Expanded `src/pages/EditForm.tsx` so admins can refresh channels, choose approval queue and destination routing, and save those values with the form.
- Verified with `npx convex codegen`, `npx tsc --noEmit`, `npm run lint:code`, and a runtime sanity check against the active Convex and Vite terminals.

### 2026-04-18 — Form editor workspace redesign

- Added `prds/form-editor-workspace-redesign.md` to capture the responsive builder redesign before implementation.
- Reworked `src/pages/EditForm.tsx` into a toggleable workspace with one, two, or three visible panes for command settings, modal fields, and Discord preview.
- Added a mobile pane switcher, inline field cards, Phosphor pane and layout icons, and custom tooltips through `src/components/ui/Tooltip.tsx`.
- Refined `src/styles/index.css` with a more intentional workspace backdrop so the builder feels less flat.
- Verified with `npx tsc --noEmit` and `npm run lint:code`.

### 2026-04-17 — Convex JWT trust config

- Added `convex/auth.config.ts` with `domain = CONVEX_SITE_URL`, `applicationID = "convex"`.
- Unblocks `ctx.auth.getUserIdentity()` for Robel-issued sessions.

### 2026-04-17 — GitHub OAuth token exchange fix

- Patched `@robelest/convex-auth@0.0.4-preview.27` `normalizeTokens` to swallow arctic's throw when `expires_in` is missing (GitHub OAuth Apps never send it).
- Installed `patch-package` + `postinstall` script so the fix survives `npm install`.
- `.28` and `.29` skipped because they ship a broken `workspace:*` dependency.

### 2026-04-17 — Access control + ESLint

- Backend email gate in `convex/lib/access.ts` (`isAllowedEmail`, `roleForEmail`, `requireAllowedIdentity`)
- `api.users.access` probe query + `me` tightened to reject non-allowlisted identities
- `upsertFromIdentity` throws `ConvexError("access_denied")` for non-`@convex.dev` accounts and always assigns `wayne@convex.dev` the `owner` role
- Frontend `useEnsureAppUser` branches on `access.allowed` before querying `me` or firing the upsert
- New `AccessDenied` page + `/auth/denied` route, wired through `Protected`
- Flat-config ESLint with `@convex-dev/eslint-plugin` recommended rules, `typescript-eslint` type-aware parsing, and `eslint-plugin-react-hooks`; auto-fixed an `explicit-table-ids` violation in `users.ts`
- convex-doctor clean run at 90/100 (all errors triaged as false positives or scoped to Phase 2 schema work)
