# Changelog

All notable changes to Forge. Format follows [keepachangelog.com](https://keepachangelog.com/en/1.1.0/). Dates are UTC.

## [Unreleased]

## 2026-04-19 06:31 UTC

### Added

- New canonical social card image at `public/forge-og-image.png` (3024x1634 PNG). (2026-04-19 06:31 UTC) Used by both `index.html` and `src/pages/About.tsx` as the `og:image` and `twitter:image` target so every share surface (Slack, Discord, LinkedIn, X, iMessage) renders a large preview instead of the old 32x32 favicon.

### Changed

- `index.html` now advertises a summary-large-image card. (2026-04-19 06:31 UTC) Swapped `og:image` and `twitter:image` from `/favicon.svg` to `/forge-og-image.png`, upgraded `twitter:card` from `summary` to `summary_large_image`, and added `og:image:type`, `og:image:width=3024`, `og:image:height=1634`, `og:image:alt`, and `twitter:image:alt`. Static scrapers pick these up without running JS.
- `src/pages/About.tsx` patches OG and Twitter metadata at mount. (2026-04-19 06:31 UTC) The page-mount `useEffect` now overrides `og:title`, `og:description`, `og:image`, `og:image:alt`, `og:url`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:alt`, and the page `description` meta tag so JS-capable scrapers that crawl `/about` see About-specific copy and the large card image. The effect snapshots each tag's previous `content` (or records that it created the tag) and restores on unmount so the metadata does not leak to other SPA routes. New top-of-file constants `OG_IMAGE_PATH`, `OG_IMAGE_ALT`, `ABOUT_OG_TITLE`, and `ABOUT_OG_DESCRIPTION` keep the copy in one place.

### Verification

- `npx tsc --noEmit -p tsconfig.app.json` clean.
- `ReadLints` on `index.html` and `src/pages/About.tsx` clean.

## 2026-04-19 06:04 UTC

### Changed

- Hero of the public `/about` page now treats the Lightning mark and the "Forge" wordmark as a single clickable home link. (2026-04-19 06:04 UTC) Wrapped both in a `<Link to="/">` on `src/pages/About.tsx` with `aria-label="Forge home"` and a `focus-visible` ring so keyboard users get the same affordance as mouse users. The `/ about` breadcrumb and the "Open source on GitHub" pill stay outside the link so only the logo acts as the home button.
- Hero intro copy on `/about` now reads "Apache License 2.0 and self hostable on your own Convex project" instead of "MIT licensed...". The repo ships Apache-2.0 and the Colophon at the bottom of the page already said so, so the top of the page was the odd one out.
- Stack section `Auth` row on `/about` is now a link. New top-of-file constant `CONVEX_AUTH_URL = "https://github.com/robelest/convex-auth/"` powers the `StackItem` `href`, so "Convex Auth with GitHub OAuth" points at the upstream fork Forge actually ships with, matching the Backend, Hosting, Icons, and Source rows.

### Verification

- `ReadLints` on `src/pages/About.tsx` clean.

## 2026-04-19 03:02 UTC

### Added

- Unpublish a form from the editor. (2026-04-19 03:02 UTC) New action `convex/discord.ts#unregisterCommand` DELETEs the Discord guild slash command, flips `forms.published` back to false, clears `discordCommandId`, and writes a `form_unpublished` audit row. New internal helpers `forms.getForUnpublish`, `forms.recordUnpublishedSlashAttempt`, and `forms.recordCommandUnpublished` back the flow. `src/pages/EditForm.tsx` gains an Unpublish button next to Publish in both the sticky toolbar and the fields-pane bottom row, plus a site-design-system `UnpublishConfirmDialog` that mirrors `ConfirmDeleteDialog` so the confirm surface feels the same as delete. 204 and 404 from Discord are both treated as success so Forge never gets stuck in a "published" state after Discord has already forgotten the command. `FormLogs.tsx` adds labels for the two new action names. PRD: `prds/slash-command-debug-logging-and-unpublish.md`.
- Differentiated logging and audit trail for slash commands that miss. (2026-04-19 03:02 UTC) `convex/http.ts` now splits the `/interactions` command path into two explicit branches: `console.warn("slash_command_form_not_found", { discordGuildId, commandName })` when the guild or form is missing (no audit row, we have no verified guild id to scope one to), and `console.warn("slash_command_form_unpublished", { ... })` plus a `slash_command_unpublished_attempt` audit row when the form exists but is draft. The 2026-04-19 deployment-mismatch bug would have shown up immediately with this in place.

### Verification

- `npx tsc --noEmit -p convex/tsconfig.json` clean
- `npx tsc --noEmit -p tsconfig.app.json` clean
- `npx eslint convex/http.ts convex/forms.ts convex/discord.ts src/pages/EditForm.tsx src/pages/FormLogs.tsx` clean

## 2026-04-19 02:01 UTC

### Changed

- Tightened the global border-radius from 12px to 0.25rem (4px) so every card, dropdown, button, tooltip, and inline code chip shares one crisp, technical edge. (2026-04-19 01:09 UTC) Single source of truth edit in `src/styles/index.css` (`--radius-window: 0.25rem`) cascades to the 70+ `rounded-[var(--radius-window)]` usages across the app. Normalized the About page in the same pass: five `rounded-[20px]` hero and figure boxes (InternalAppNotice, builder mockup, Discord mockup, ticket mockup, results mockup) and six pill-shaped CTA buttons (hero trio plus closing trio) now use the shared token. Normalized two stray `rounded-md` inline code chips in `src/pages/Docs.tsx`, the `rounded-xl` tooltip in `src/components/ui/Tooltip.tsx`, and two `rounded-[6px]/[8px]` drag-handle chips in `src/pages/EditForm.tsx`. Intentional circles (Mac window dots, icon badges, step numbers, avatars, social icon buttons) remain `rounded-full`. Verified with `ReadLints` on every edited file (clean) and a repo-wide grep for `rounded-(sm|md|lg|xl|2xl|3xl)` and hard-coded pixel radii that returns zero matches outside intentional circles.
- Rewrote the public `/about` marketing page and the sign-in footer so the hosted Forge instance reads as an internal Convex team app rather than a general-purpose sign-in destination.
  - `src/pages/About.tsx` — removed both sign-in CTAs (the hero "Sign in with GitHub" button and the closing "Sign in to Forge" button). Added an `InternalAppNotice` card directly under the hero eyebrow that states sign in is locked to `@convex.dev` emails and points visitors at the fork + docs path. Primary hero CTA is now `Fork the repo` (deep-links to `/fork`), backed by `Read the setup guide` and `Join the Convex community`. Closing CTA mirrors the same three actions. Footnote changed from "For Convex by Convex. Open source and free to self host." to "For Discord servers built with Convex." with the word "Convex" linking out to `https://www.convex.dev`.
  - New external links centralised at the top of the file: `REPO_FORK_URL`, `CONVEX_URL`, `CONVEX_STATIC_HOSTING_URL`, `CONVEX_COMMUNITY_URL`, `AUTHOR_X_URL`, `AUTHOR_LINKEDIN_URL`, `AUTHOR_GITHUB_URL`.
  - Stack table: `Backend` row now links to `https://www.convex.dev`, `Hosting` row links to `https://www.convex.dev/components/static-hosting`, and the `Source` row copy updated to "Open source, fork and self host".
  - Added a new `Colophon` section at the very bottom of the page: "Created by Wayne with Convex, Cursor, and Claude Opus 4.7. Connect on Twitter/X, LinkedIn, and GitHub." plus "This project is licensed under the Apache License 2.0." with an outbound link to the license text. Social row uses Phosphor `XLogo`, `LinkedinLogo`, `GithubLogo`, and `DiscordLogo` icon-only pills with `aria-label`s.
  - `src/components/auth/SignIn.tsx` — attribution changed to "For Discord servers built with Convex." keeping the inline `About` link. Replaced the single "Read the setup guide" text link with a three-icon row (Phosphor `BookOpen` → `/docs`, `GithubLogo` → repo, `DiscordLogo` → Convex community) so visitors who cannot sign in still have three ways to explore the project.
  - `docs/setup-guide.md` and `src/pages/Docs.tsx` (overview section) both grew an internal-app note after the opening paragraph explaining that sign in on the hosted instance is locked to one email domain the admin configures and the reader should fork + self host.
- Scrubbed the Convex email domain (`@convex.dev`) and the upstream owner email (`wayne@convex.dev`) out of every public doc surface so a fork of Forge never ships the hosted instance's team domain or owner inbox. Three edits per surface: the hosted-instance heads-up note (now "locked to a single email domain the admin configures"), the `OWNER_EMAIL` optional-env paragraph (now points readers at the compile-time fallback in `convex/lib/access.ts` instead of naming the email), and the allowlist helper description (now "a single email-suffix domain the admin configures, set via `ALLOWED_EMAIL_SUFFIX`"). The Discord setup's sign-in step under "Install the bot" now says the account email must match the allowlist domain the admin configures instead of naming the Convex domain. Files: `docs/setup-guide.md`, `docs/discord-setup.md`, `src/pages/Docs.tsx`. Verified with `ReadLints` (clean) and a repeat `Grep` across `docs/` and `src/pages/Docs.tsx` that returns zero matches for either string.
- Verification: `npx tsc --noEmit -p tsconfig.app.json` and `ReadLints` on the edited files clean.

### Fixed

- Discord install OAuth callback sometimes redirected admins on the live `convex.site` host to `http://localhost:5173/app/settings?error=...` after a cancelled or completed install. (2026-04-19 01:58 UTC) Root cause: `convex/http.ts` built the callback redirect from `process.env.APP_URL ?? url.origin`, and `APP_URL` had drifted to the localhost value from `.env.example` on the prod Convex deployment, so every Discord 302 bounced admins onto the wrong origin. Fix moves the redirect origin out of env and into the `oauthStates` row: `convex/schema.ts` adds an optional `returnOrigin` column, `convex/oauthStates.ts` accepts it on `create` and returns it on `consume`, `convex/discord.ts` adds a `returnOrigin` arg to `generateInstallUrl` plus a `sanitizeReturnOrigin` helper that rejects anything other than an `http:` or `https:` URL and stores only `URL.origin`, `src/pages/Settings.tsx` passes `window.location.origin` when calling the action, and `convex/http.ts` consumes state first (even on the error branch) so every redirect uses `nonce.returnOrigin ?? APP_URL ?? url.origin`. `APP_URL` is now a soft fallback, not a single point of failure. The user separately corrected `APP_URL` and `SITE_URL` on the prod deployment in the same session. Verified with `npx tsc --noEmit` and `npx tsc --noEmit -p convex/tsconfig.json` (both clean) and `ReadLints` on the five touched files.
- Static hosting deploy failed with `Could not find function for 'staticHosting:generateUploadUrls'`. Root cause: the `@convex-dev/static-hosting@0.1.3` CLI calls the batched `generateUploadUrls` (plural) and `recordAssets` helpers introduced in 0.1.3, but `convex/staticHosting.ts` was still destructuring only the four functions the README example shows (`generateUploadUrl`, `recordAsset`, `gcOldAssets`, `listAssets`). The batched helpers therefore never got registered as Convex functions, so the CLI's `npx convex run staticHosting:generateUploadUrls` blew up with "Did you forget to run `npx convex dev`?" halfway through `npx @convex-dev/static-hosting deploy`. Fix: added `generateUploadUrls` and `recordAssets` to the destructured export so every function the CLI expects is now registered. No app code change beyond the one destructuring line. Verified with `ReadLints` on `convex/staticHosting.ts` (clean). File-by-file check in `node_modules/@convex-dev/static-hosting/dist/cli/upload.js:175` confirmed the CLI calls the plural name.

### Added

- Public `/about` marketing page. `src/pages/About.tsx` ships a paper.design inspired editorial layout with huge display type and four large SVG product mockups stored at `public/about/builder.svg`, `public/about/queue.svg`, `public/about/ticket.svg`, and `public/about/results.svg`. Sections: hero with sign in and docs CTAs, intro positioning ("one app, every step of the form"), builder mockup with a four point grid, dark Discord band with a mod queue embed, a full six-group feature index (Build, Publish, Moderate, Ticket mode, Review, Observe) plus a 12-item legend row, ticket lifecycle visual, results dashboard mockup, dark stack table, and a closing CTA. Matches the existing Forge tokens (ink, accent, beige, surface). No header and no footer, per brief.
- Route wired in `src/App.tsx` at `/about`. Catch-all redirect to `/` still covers every other unknown path.
- About link on the homepage only. `src/components/auth/SignIn.tsx` now renders "For Convex by Convex. About" as an inline attribution with the word "About" linking to `/about`. Kept the existing "Read the setup guide" link on the opposite side of the footer row. No other page links to About, so the marketing story stays scoped to the sign in surface.
- Verification: `npx tsc --noEmit -p tsconfig.app.json` clean. `ReadLints` on `src/pages/About.tsx`, `src/App.tsx`, and `src/components/auth/SignIn.tsx` clean.

### Fixed

- `/about` hero image showed as a broken icon because all four product mockup SVGs used HTML-only named entities (`&middot;`, `&hellip;`, `&rarr;`) inside `<text>` nodes. SVG is strict XML, so browsers refused to parse them and rendered the `alt` text as a collapsed `img` with no intrinsic size. Replaced every instance in `public/about/builder.svg`, `public/about/queue.svg`, `public/about/ticket.svg`, and `public/about/results.svg` with the literal Unicode characters (U+00B7, U+2026, U+2192). Verified with `xmllint --noout` on all four files.
- Added open source messaging and two new outbound links to `src/pages/About.tsx`: a GitHub pill in the hero eyebrow, a "View the repo" CTA next to the sign in button, a source-on-GitHub line in the intro paragraph, a "Source" row in the stack table linking to the public repo, a linked "Phosphor Icons" row pointing at `phosphoricons.com`, and a "Star it on GitHub" button in the closing CTA. Repo URL centralized as `REPO_URL` and `PHOSPHOR_URL` at the top of the file so it is one edit if either moves.
- Pointed every Forge repo link at the canonical `https://github.com/waynesutton/forge-for-discord` URL. Updated `REPO_URL` in `src/pages/About.tsx` (which covers every hero pill, CTA, stack row, and closing button on the marketing page in one edit) and added a "Forge source code" line to the References section of `docs/setup-guide.md`, `docs/discord-setup.md`, and the in-app mirror in `src/pages/Docs.tsx`.

## earlier sessions (timestamps unavailable)

### Security

- Shipped fixes for every HIGH / MEDIUM / LOW finding from the 2026-04-18 Convex security audit. Full disposition lives in `prds/security-audit-fixes-2026-04-18.md`.
  - HIGH #1 (IDOR) is intentional for the shared `@convex.dev` workspace phase and is now documented as such in `convex/lib/auth.ts` and `docs/setup-guide.md`. The PRD lists the follow-up (add a `memberships` table and a `requireGuildAccess` helper before the allowlist ever widens).
  - HIGH #2: `convex/discord.ts` no longer packs the raw Discord API response body into `ConvexError`. Four failure sites (`discord_register_command_failed`, `discord_channels_refresh_failed`, `discord_roles_refresh_failed`, `discord_exchange_failed`) now `console.error` the `{ status, body }` server-side and return `{ code, status }` only. The dashboard already keyed off `error.message.includes(<code>)`, so the UI copy for publish, channel refresh, and role refresh errors is unchanged.
  - MEDIUM #3: Approve / Deny buttons in `convex/http.ts` now fail closed when `form.modRoleIds` is empty. The handler calls `hasAdministratorPermission(payload.member?.permissions)` (the same helper the ticket gate uses) and only allows Discord server admins. When `modRoleIds` is configured, the caller must carry a matching role OR the Administrator bit. Rejection copy tells moderators to add a mod role if they want to open moderation to non-admins.
  - MEDIUM #4: `convex/http.ts` install callback no longer reflects `err.message` into the redirect URL. A two-stage `try` tracks whether the failure happened during token exchange or guild registration and redirects with stable opaque codes (`oauth_exchange_failed`, `oauth_register_failed`). Raw error is logged via `console.error`. `src/pages/Settings.tsx` adds friendly banner copy for both codes.
  - MEDIUM #5: `convex/auditLog.ts` now sanitizes `metadata` before returning. The query strips `body`, `response`, `responseBody`, `stack`, `error`, `rawError`, and `raw` keys while preserving the `detail` string the UI already renders. Keeps the `v.any()` validator but fences off the specific fields Discord errors land in.
  - LOW #6: CORS preflight on `/interactions` and `/api/discord/install` no longer returns `Access-Control-Allow-Origin: *`. `buildCorsHeaders()` in `convex/http.ts` pins the allow-origin to `process.env.SITE_URL` when set and omits the header otherwise. Discord is server-to-server and never fires an OPTIONS, so this is a defense-in-depth tightening with no functional impact.
  - LOW #7: `convex/lib/access.ts` now reads the owner email from `process.env.OWNER_EMAIL`, falling back to `wayne@convex.dev` so the existing dev deployment keeps its owner assignment. `.env.example` and `docs/setup-guide.md` document the new variable. Recommended action for anyone forking Forge: `npx convex env set OWNER_EMAIL you@yourdomain.com` in dev and again with `--prod`.
- Verification: `npx tsc --noEmit -p convex/tsconfig.json`, `npx tsc --noEmit -p tsconfig.app.json`, and `npx eslint convex/ src/` all clean after the changes.

### Changed

- Pulled the `OWNER_EMAIL` env var into every copy-paste command block in the setup docs. `docs/setup-guide.md` adds it to the "Set the rest of the auth env on Convex" dev block, the matching prod block, the "Set prod env vars on the prod deployment" block under "Go from localhost to production", and the "Set the same keys on prod with --prod" block under the env var reference table. `src/pages/Docs.tsx` adds the same lines to the in-app docs plus the "Admin access and how to add admins" section (now includes the dev and prod `npx convex env set OWNER_EMAIL` commands inline). The Environment variables reference table in the in-app docs grew a new row for `OWNER_EMAIL` and a short "Tenancy model" callout that points at `prds/security-audit-fixes-2026-04-18.md`. Purely doc clarity after the 2026-04-18 security audit shipped the env var itself; no backend change.

### Changed

- Stopped tracking local AI assistant configs in git. `.gitignore` now excludes `.cursor/`, `.claude/`, `.agents/`, `.codex/`, `.gemini/`. Ran `git rm -r --cached` on `.cursor`, `.claude`, and `.agents` to untrack 160 previously committed files while leaving them on disk. The files are still staged for removal and still live in git history; a future `git filter-repo` pass is needed if they must be scrubbed from history. No application code changed.

### Fixed

- Logout from `/app` no longer flashes the access denied screen for allowlisted admins. Root cause: `signOutNow()` cleared the Convex auth token synchronously via `convex.clearAuth?.()`, but the Robel auth client's `onChange` (and therefore `isAuthenticated`) only flipped after the async `auth.signOut()` round-trip completed. During that window, `api.users.access` refetched unauthenticated and returned `{ authenticated: false, allowed: false }`, and `src/components/auth/Protected.tsx` hit its `!access.allowed` branch before the `!isAuthenticated` branch, sending valid admins to `/auth/denied`. Fix: `Protected` now checks `access.authenticated` first and routes those sessions to `/`; `/auth/denied` is reserved for real authenticated-but-not-allowlisted cases. `src/pages/Dashboard.tsx` also calls `navigate("/", { replace: true })` before awaiting `signOut()` so the `/app` subtree unmounts and the access query is skipped during the transition. Belt-and-suspenders, no behavior change for happy-path signouts.

### Added

- Public docs surface at `/docs` and `/docs/:slug`. `src/App.tsx` moves the docs route out from under `Protected` so anyone evaluating Forge can read the setup guide without signing in. `/app/docs` and `/app/docs/:slug` now redirect to `/docs` for back-compat. `src/pages/Docs.tsx` reads the `Protected` outlet context with `useOutletContext` (returns `undefined` on the public route), hides the Settings link and the Forms/Docs/Settings tabs for logged-out visitors, swaps the back button target between `/app` and `/`, and adds a Sign in CTA in the top right for unauth. `src/components/auth/SignIn.tsx` gains a "Read the setup guide" link under the Continue with GitHub button. Dashboard and Forms page links now point at `/docs`.
- New "Go from localhost to production" section in `docs/setup-guide.md` and `src/pages/Docs.tsx` (slug `localhost-to-production`). End-to-end checklist covering: proving the flow works on dev first, creating a separate Convex prod project via `npx convex init --prod`, creating a second Discord application with the prod Interactions endpoint and OAuth redirect, creating a second GitHub OAuth app with the prod `/.auth/callback/github` callback, setting every prod env var through `npx convex env set --prod`, running `npm run deploy`, and a smoke test + secret rotation guide. References Convex site URLs as `<your dev convex site url>` and `<your prod convex site url>` placeholders (shape: `https://your-dev-deployment.convex.site`) instead of baking the current workspace's deployment names into the docs. Matches the style used on https://www.convex.dev/components/static-hosting so the guide stays useful for any reader cloning the repo.

### Changed

- Logout redirect now lands on the homepage (`/`) instead of `/auth/sign-in`. `src/App.tsx` maps `/` directly to the `SignIn` component (with `/auth/sign-in` kept as an alias so older links still work). `src/components/auth/Protected.tsx` redirects unauthenticated sessions to `/`. `src/pages/AccessDenied.tsx` "Use a different account" link now points at `/`. `SignIn` already short-circuits to `/app` for authenticated sessions so returning admins still land inside the app.
- Rewrote the auth sections of `docs/setup-guide.md` and `src/pages/Docs.tsx` to document the current `@robelest/convex-auth` + GitHub OAuth flow instead of the planned WorkOS AuthKit migration. Covers how sign-in works end to end (homepage → Robel browser client → GitHub → `/.auth/callback/github` → JWT with `iss = CONVEX_SITE_URL` → allowlist check via `auth.user.viewer(ctx)`), the files that own each piece (`convex/auth.ts`, `convex/auth.config.ts`, `convex/convex.config.ts`, `convex/http.ts`, `convex/lib/auth.ts`, `convex/users.ts`, `src/lib/auth.ts`, `src/hooks/useAuth.ts`, `src/components/auth/SignIn.tsx`, `src/components/auth/Protected.tsx`, `patches/@robelest+convex-auth+0.0.4-preview.27.patch`), how to create the GitHub OAuth App (callback URL must end in `/.auth/callback/github`), how to generate `JWT_PRIVATE_KEY` and `JWKS` via `npx @robelest/convex-auth`, and the env var matrix (`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, auto-populated `CONVEX_SITE_URL`). Troubleshooting section now lists the Robel-specific failure modes (GitHub primary email mismatch, rotated OAuth secrets, regenerated keys, `OAUTH_PROVIDER_ERROR` on a bad callback URL, and the `auth:signIn`/`refreshSession` loop fixed by `useAutoSignOut`).

### Added

- In-app docs surface at `/app/docs` (and deep link `/app/docs/:slug`). New `src/pages/Docs.tsx` ships a setup guide for logged-in admins with a sidebar that groups sections into Start here, Setup, Auth, Deploy, and Reference. Each section carries a Copy markdown button and a Copy link button, renders from a single markdown source string via an in-file renderer (headings, lists, fenced code with copy, pipe tables, inline code, bold, links), and includes Previous and Next navigation. Wired routes in `src/App.tsx`, added a Docs button and quick-link tile in `src/pages/Dashboard.tsx`, and added a Docs tab to the `WindowTabs` row in `src/pages/Forms.tsx`.
- Canonical setup guide at `docs/setup-guide.md`. Covers what Forge does, feature list, architecture, prerequisites, Convex setup, Discord application walkthrough with the interactions and OAuth redirect URLs, the seven-permission bitmask plus scopes, bot invite flow, the current `@robelest/convex-auth` + GitHub OAuth setup with the files that own each piece, admin allowlist rules and the files to change (`convex/lib/access.ts` plus dependents), env var matrix for frontend and Convex deployment, static hosting deploy via `@convex-dev/static-hosting` with the current dev (`honorable-mammoth-130.convex.site`) and future prod (`usable-kiwi-349.convex.site`) site URLs, troubleshooting, and an external reference list (Discord portal, Discord dev reference, Discord API repo, Convex static hosting, Robel Convex Auth repo and docs, GitHub OAuth Apps, Robel integration notes).

### Changed

- App-wide UI polish pass on 2026-04-18. `index.html` now preloads Inter and JetBrains Mono from Google Fonts so the Matter fallback never shows a system font by default. `src/styles/index.css` swaps the `--font-sans` primary to Inter with proper fallbacks, enables font features (`ss01`, `cv11`, `cv02`) and antialiasing, tightens heading letter-spacing, softens the workspace background gradient, adds a global `:focus-visible` outline that matches the ink token, and honors `prefers-reduced-motion` by stripping transitions for opted-in users. No tokens or layouts changed.
- Copy clarity pass across the auth and dashboard surfaces. `src/components/auth/SignIn.tsx` subtitle now reads "Design Discord forms and review submissions in one place" and the pending button reads "Opening GitHub". `src/pages/AccessDenied.tsx` leads with "This account can't use Forge", explains the allowlist rule inline with the signed-in email, and the retry button reads "Use a different account". `src/pages/Dashboard.tsx` greets the user with "Jump back in", tightens the quick-link descriptions, and reframes the connect banner to "Connect a Discord server to get started". `src/pages/Forms.tsx` retitles the workspace to "Your forms" with a plain-English subtitle and adds `role="status"` / `aria-live="polite"` to its loading state. `src/pages/NewForm.tsx` simplifies field helper text, updates the submit hint to "Next: add fields, pick a channel, then publish", and rewrites every `formatCreateError` branch to tell the admin what to do next. `src/pages/Settings.tsx` clarifies the Discord server description, the empty state, the disconnect confirmation ("can't be undone"), and every `errorMessage` / `formatDisconnectError` branch. All button labels that hang while a network call runs now append a trailing ellipsis so the pending state reads as in-progress, not a second verb.

### Added

- Developer marketing intro in `README.md`. Opening section now explains who Forge is for, what it replaces, and the stack tradeoffs (Convex-only deployment, type-safe end to end, reactive subscriptions, Ed25519 verify) so the README doubles as the pitch used for SEO previews.
- SEO metadata in `index.html`. Adds a longer `<title>`, richer `<meta name="description">`, `keywords`, `theme-color`, full Open Graph tags (`og:type`, `og:title`, `og:description`, `og:image`, `og:site_name`), Twitter summary card tags, `robots`, and an Apple touch icon fallback.
- Project favicon at `public/favicon.svg`. Rounded beige square with a 1px border and an orange lightning bolt in the accent color (`#f54e00`) that matches the in-app Lightning icon.
- Feature grid on `/auth/sign-in`. `src/components/auth/SignIn.tsx` now renders a second card below the sign-in surface labeled "Inside Forge" with eight icon + label rows aimed at developers: visual form builder, one-click slash commands, mod queue approvals, ticket mode, per form audit log, CSV and PDF export, private fields stay private, and reply from the dashboard. Same window-chrome styling and accent color as the rest of the app.

### Changed

- Moved the sign-in card toward the top of the viewport. `src/components/auth/SignIn.tsx` switched from vertically centered to top-aligned with `pt-12 sm:pt-16`, and inner card padding tightened from `py-10` to `py-8` so the card and feature grid both fit above the fold on a laptop.
- Replaced the terms of use footnote on `/auth/sign-in` with "For Convex by Convex." The screen is an internal tool; the new line reflects that without implying an external TOS.
- Simplified the `/auth/denied` copy in `src/pages/AccessDenied.tsx`. Removed the paragraph about GitHub primary email and workspace invites; the screen now reads a single line: "Forge is limited to Convex team accounts." The cached email chip and "Try another account" link stay.

### Added

- Wrote a real `README.md` covering what Forge does, feature list, stack, getting started, scripts, access model, and links to project docs. Flipped the `README.md` row in `files.md` from `planned` to `live`.

### Changed

- Removed third-party brand references from design tokens and docs. Design token comments, file docs, task list, and PRDs now describe the aesthetic in Forge's own terms. Touched `src/styles/index.css`, `files.md`, `TASK.md`, `prds/forge-prd_1.md`, and `prds/access-control.md`.

### Added

- Ticket mode role gates. Admins can now set two new role lists per form: **Claim role** (`forms.ticketClaimRoleIds`) and **Resolve role** (`forms.ticketResolveRoleIds`). Members with a claim role can press the Claim button without being a mod; members with a resolve role can press Resolve. The submitter can press Resolve and Close on their own ticket. Admins (Discord Administrator permission) and members in `modRoleIds` keep access to every button. Reopen stays admin + mod only. The assignee rule for Unclaim still lives in `applyTicketAction`. `convex/schema.ts`, `convex/forms.ts`, `convex/submissions.ts` (route context), `convex/http.ts` (new `hasAdministratorPermission` and `ticketActionDenial` helpers replacing the old single mod-role gate in `handleTicketButton`), and `src/pages/EditForm.tsx` (two RolePicker blocks inside the ticket mode panel) share the wiring.

### Fixed

- Email fields now honor the "private by default" label shown in the field type picker. `convex/discord.ts:buildSubmissionEmbed` gained an `audience` parameter (`mod_queue` or `destination`); `publishSubmissionImpl` and `updatePublishedTicketMessage` pass `destination`, which strips fields whose type matches the new `isPrivateFieldType` allow-list (currently just `email`). Mod queue posts and the dashboard still show the full answer set so moderators can contact the submitter, but the public destination channel no longer leaks email addresses.

### Added

- Form activity logs. New `/app/forms/:formId/logs` page shows every submission, decision, ticket action, Discord routing attempt, and DM delivery for a form in reverse chronological order. Each row renders date and time, event label, actor (moderator, submitter, or system), status (success or error), and a short summary; rows expand to show structured metadata and a Copy button that yanks the error detail or metadata JSON. A top-right filter toggles between All and Errors only. `convex/submissions.ts` now writes `submission_created`, `mod_queue_posted`, and `submission_published` audit rows so the log reflects successes too, not just the existing `logRoutingSkip` failures. Backed by new `convex/auditLog.ts:listForForm` query and `src/pages/FormLogs.tsx` route; wired from new Logs and Results buttons in the top right `WindowFrame` header on both the form editor and the results page.
- Discord error code translation on the logs page. `src/pages/FormLogs.tsx` now parses the `<status>:<body>` detail string, extracts the Discord JSON error code, and rewrites the row summary into plain English plus a one line fix (for example "Missing Access. Bot is missing access to this channel. Grant the bot role View Channel, Send Messages, and Embed Links."). Known codes today: `10003`, `50001`, `50013`, `50035`, `160002`. Raw JSON stays in the expanded Copy panel for sharing with support.

### Changed

- Removed the duplicate Logs and Results buttons from the Editor workspace card in `src/pages/EditForm.tsx`. They now live only in the top right `WindowFrame` header so the workspace card focuses on Save draft and Update Discord command.

- Ticket mode for support and bounty request flows. Opt-in per form via a new `ticketMode` checkbox in Command settings. When on, published Discord messages attach Claim, Resolve, Close, and Reopen buttons; the embed footer and color reflect the current lifecycle state (open, in progress, resolved, closed); and moderators can claim tickets so assignee name lives inside the embed. Schema adds `forms.ticketMode`, `forms.autoCloseInactiveDays`, and `submissions.ticketStatus`, `assignedToUserId`, `assignedToUserName`, `assignedAt`, `lastActivityAt`, plus a new `by_ticketstatus_and_lastactivityat` index. Existing forms default to ticket mode off, so nothing changes for non-ticket workflows. `convex/schema.ts`, `convex/forms.ts`, `convex/submissions.ts` (new `recordTicketAction`, `applyTicketAction`), `convex/discord.ts` (new `buildTicketComponents`, `updatePublishedTicketMessage`, `archiveForumThread`), `convex/http.ts` (new `ticket:*` button handler), and `src/pages/EditForm.tsx` share the toggles.
- Auto close inactive tickets. Forms with ticket mode can set `autoCloseInactiveDays`; a new `convex/crons.ts` hourly job (`internal.submissions.sweepAutoCloseTickets`) walks open and in-progress tickets and closes any whose `lastActivityAt` is older than the configured window. Closes archive and lock forum threads and refresh the published message footer so channels stop collecting replies. Budgeted to 50 rows per run so a large backlog never exhausts the transaction wall.
- Reply from dashboard. `src/pages/FormResults.tsx` now shows a collapsed "Reply in Discord" composer on submissions that have been published. `api.submissions.postReply` validates the body, records an audit row, and schedules `internal.discord.postReplyToSubmission`, which posts into the forum thread for forum destinations and as a threaded reply for text destinations. Replies are authored by the bot, prefixed with the signed-in moderator's name, and use `allowed_mentions.parse = []` so no one gets pinged.
- Number field type. New `number` modal field with optional `minValue`, `maxValue`, and a free-form `currencyUnit` label (display only). Discord modal hints surface the bounds to submitters, `convex/submissions.ts:validateAndSanitize` enforces range on server write, and published Discord embeds plus the dashboard, CSV, and PDF exports format values with `Intl.NumberFormat` and append the unit. Useful for bounty amounts, hour estimates, or priority scores without adding a wallet or payment flow.

- Link submitter on publish. Forms now carry a `linkSubmitterOnPublish` flag (default on). When enabled, published Discord messages prepend `Submitted by <@submitterId>` so channel members can click through to the submitter's profile. Mentions use `allowed_mentions.parse = []` to render as a pill without pinging. Works for both approved submissions and auto-published submissions when approval is off, across text channels and forum threads. `convex/schema.ts`, `convex/forms.ts`, `convex/submissions.ts` (route context), `convex/discord.ts` (`publishSubmissionImpl`), and `src/pages/EditForm.tsx` (toggle).
- Optional moderator name on Discord. Forms now have a `showModeratorInFooter` setting in Command settings. When off, published Discord embeds footer reads "Approved" or "Denied" instead of "Approved by {name}" so moderators can stay anonymous to the channel. Existing forms default to showing the name. `convex/schema.ts`, `convex/forms.ts`, `convex/submissions.ts` (route context), `convex/discord.ts` (embed footer), and `src/pages/EditForm.tsx` (toggle) share the flag. The admin-only results dashboard continues to show who decided each submission.
- Dashboard approve and deny. `src/pages/FormResults.tsx` now shows Approve and Deny buttons on pending rows when the form has `requiresApproval` on, plus a new `DenySubmissionDialog` for collecting the reason. The new `api.submissions.decide` public mutation and the existing `internal.submissions.recordDecision` both call a shared `applyDecision` helper so approvals posted from the dashboard publish, update the mod queue embed, DM the submitter, and write the same audit row as the Discord button path. The signed-in admin's name and email become the moderator identity.

### Fixed

- `submissions.decide` threw `Missing CONVEX_SITE_URL while configuring github OAuth provider` because `ctx.runMutation(internal.submissions.recordDecision, …)` re-evaluated `convex/auth.ts` in a fresh isolate. Refactored the approve/deny path to share an in-module `applyDecision` helper so both the Discord button path and the dashboard path stay in the same transaction and skip the nested mutation hop.
- Results quick link from the editor. `src/pages/EditForm.tsx` now renders a Results action in the `WindowFrame` header that jumps to the form's results page, mirroring the existing Back to editor link on the results side.

### Added

- Expanded modal field types. `convex/schema.ts` and `convex/forms.ts` now accept `email`, `code`, `select`, `yes_no`, and `checkbox` fields alongside `short` and `paragraph`, with per field `helperText` and `options`. `convex/http.ts` builds classic text-only modals or Label-wrapped modals with `STRING_SELECT` depending on the field mix, and `collectModalValues` recurses through the Discord payload so it captures both inputs and selects.
- Input sanitization and validation. `convex/submissions.ts` ships `validateAndSanitize`, which strips HTML, zero-width characters, null bytes, and odd whitespace, enforces min and max length, checks basic email format, and verifies that option-based submissions match an allowed option id before anything is written to the database.
- Code block rendering. `convex/discord.ts` now renders `code` fields inside triple-backtick blocks in mod queue and destination embeds, while `src/pages/FormResults.tsx` shows them inside a styled `<pre><code>` block with a copy icon in the dashboard. `src/lib/exportResults.ts` now resolves option ids to labels for CSV and PDF exports.
- Editor polish in `src/pages/EditForm.tsx`. Adds a `FieldTypePicker` dropdown for adding fields, a dedicated `FieldEditor` with type change, helper text, required toggle, placeholder, min and max length, options, and a one-option confirmation editor, plus a pencil icon on each field row so members know rows are editable.
- Moderator roles picker. The Command settings pane now shows a Moderator roles `RolePicker` when `requiresApproval` is on, wired through `form.modRoleIds`. `convex/forms.ts:update` now accepts and normalizes `modRoleIds` and validates them against cached guild roles.
- Consolidated save actions. The Command settings pane now echoes Save draft and Update Discord command buttons at the bottom with an Unsaved changes marker so admins do not have to scroll back to the top toolbar.

### Changed

- Single routing surface. `src/pages/Settings.tsx` no longer renders per server channel defaults, default approval queue, default destination, forum tag, or refresh channels controls. Routing for approval queue, destination channel, and forum tag is now configured only inside each form's Command settings pane in the form editor, so there is one source of truth instead of two.
- Editor workspace layout. `src/pages/EditForm.tsx` now stacks Command settings as a full width pane on top, with Modal fields and Discord preview sharing the row below. Pane toggles and mobile pane switching still work the same, and the Discord preview stays sticky on wide screens.

### Added

- Submission moderation. `src/pages/FormResults.tsx` now ships Hide, Unhide, and Delete per row, a delete confirm dialog with an "Also remove from Discord" checkbox (default off), a Show hidden toggle, status pills, per field copy buttons, a decided-at line, and a dashed muted card for soft-hidden rows. Backed by new `submissions.setHidden` and `submissions.deleteSubmission` mutations, a new `hiddenAt` field in `convex/schema.ts`, and an `internal.discord.deleteDiscordMessages` action that DELETEs the mod queue embed plus destination message via Discord REST only when the admin opts in.
- Phase 3 approval flow. `convex/submissions.ts` schedules `internal.discord.routeSubmission` after every submit, and `convex/discord.ts` now ships `routeSubmission`, `postToModQueue`, `updateModQueueMessage`, `publishSubmission`, and `sendDecisionDM`. Submissions now post a review embed with Approve and Deny buttons to `form.modQueueChannelId`, auto-publish when `requiresApproval` is false, publish approved submissions to a text channel or forum thread with `{fieldId}` title interpolation, edit the mod queue message in place to show the decision, and DM submitters on both approve and deny.
- Button and deny modal handling. `convex/http.ts` now branches on MESSAGE_COMPONENT (type 3) to record approvals inline and open the deny reason modal, and on `deny:<submissionId>` MODAL_SUBMITs to record denials with the reason, enforcing `form.modRoleIds` on every action.
- Decision bookkeeping. `convex/submissions.ts` now ships `routeContext`, `recordDecision`, `markModQueuePosted`, `markPublished`, and `logRoutingSkip` internal functions so the Discord actions have one place to read routing data and write back Discord message ids, decision state, and audit rows for skipped or failing steps.
- Results export. `src/pages/FormResults.tsx` now ships Download CSV and Download PDF buttons backed by a new `src/lib/exportResults.ts` helper that builds a spreadsheet friendly CSV and a paginated jsPDF report using form field labels as column headers.
- Form access guards. `convex/schema.ts` now adds `guildRoles`, `convex/discord.ts` now ships `refreshGuildRoles`, and `convex/guilds.ts` now exposes role reads so the editor can cache Discord roles for form restrictions.
- Submission limits and success messaging. `convex/forms.ts` now stores required roles, blocked roles, per user lifetime caps, per day caps, and a custom success message, while `convex/submissions.ts` now stores `submittedAt` for new rows and enforces those caps on submit.
- Per form results view. New `/app/forms/:formId/results` route and `src/pages/FormResults.tsx` let admins review submissions tied to a single form with status, submitter, submitted values, and empty-state handling.
- Cached guild channel sync. `convex/schema.ts` now adds a `guildChannels` table, `convex/discord.ts` now ships `refreshGuildChannels`, and `convex/guilds.ts` now exposes channel reads plus guild level routing defaults so the UI can reactively browse Discord text and forum channels after a refresh.
- Form routing save flow. `convex/forms.ts:update` now persists `modQueueChannelId`, `destinationChannelId`, `destinationType`, and `forumTagId`, while `convex/forms.ts:create` seeds new forms from guild defaults when available.
- Submission read path. `convex/submissions.ts` now ships `listForForm` so the dashboard can render form specific results instead of only storing modal submissions internally.
- Responsive editor workspace redesign. Added `prds/form-editor-workspace-redesign.md` and a new `src/components/ui/Tooltip.tsx` helper, then reworked the form editor so admins can show one, two, or all three panes with custom tooltip help throughout the builder.
- Form editor workflow. `convex/forms.ts` now ships `get`, `update`, `getForPublish`, `getByCommand`, `getForModalSubmit`, and `setPublicationState` so Forge can load a draft, validate field edits, detect publish drift after edits, and hand a clean payload to Discord command registration.
- Discord publish path. `convex/discord.ts` now ships `registerCommand`, which creates or updates the guild slash command and stores the returned Discord command id back on the form.
- Form editor UI. New `/app/forms/:formId` route and `src/pages/EditForm.tsx` let admins edit command metadata, manage up to five modal fields, reorder fields, preview the Discord modal, save drafts, and publish to Discord from one screen.
- Submission intake write path. New `convex/submissions.ts` internal mutation stores modal submit payloads as `submissions` rows keyed by form and guild.
- Discord server disconnect flow. `convex/guilds.ts` now ships an admin-gated `disconnect` mutation that removes the guild row plus guild-scoped `forms`, `submissions`, `auditLog`, and form `cooldowns` so the workspace cannot keep orphaned records after a disconnect.
- New form draft flow. `convex/forms.ts` now ships `create`, validating title, slash command name, uniqueness per guild, and Discord's 100-char description limit before inserting a draft row. Drafts are intentionally allowed to exist before routing is configured.
- Forms list shell. New `convex/forms.ts:list` query plus `/app/forms` page wired to the connected guild. Ships `WindowFrame` and `WindowTabs` primitives, a no-guild state, an empty-forms state, and read-only form cards showing command name, field count, approval mode, destination type, and publish status.
- `docs/discord-setup.md`: end-to-end Discord install guide covering app creation, bot user setup, interactions endpoint configuration, Convex env wiring, the install OAuth flow, dev vs prod separation, verification checklist, and troubleshooting. Now documents the corrected default `DISCORD_BOT_PERMISSIONS` bitmask and the exact seven permissions it includes.
- Discord bot install flow. `/app/settings` shows a Connect server button that mints a short-lived CSRF nonce (`oauthStates` table, 10 min TTL), redirects to Discord's OAuth2 authorize URL with `scope=bot applications.commands`, and receives the callback at `GET /api/discord/install` on the Convex deployment. The HTTP action consumes the nonce, exchanges the OAuth code, pulls the `guild` payload, and writes a `guilds` row with bot token + public key + application ID copied from env. On success it bounces back to `/app/settings?installed=<guildId>` with a success banner; on any failure it redirects with `?error=<code>`.
- `convex/discord.ts`: `generateInstallUrl` and `exchangeInstallCode` actions. Default bot permissions bitmask `328565051456` covers View Channels, Send Messages, Manage Messages, Embed Links, Manage Threads, Create Public Threads, and Send Messages in Threads. Override via `DISCORD_BOT_PERMISSIONS` env.
- `convex/guilds.ts`: `list` (admin-gated, capped at 100 rows, strips `botToken` from responses), `current` (most recent guild for the dashboard banner), and `registerFromInstall` internal mutation used by the HTTP callback.
- `convex/oauthStates.ts`: CSRF nonce table with `create`, `consume`, and `gcExpired` internal mutations. Uses Web Crypto `getRandomValues` for token generation.
- `convex/users.ts:lookupBySubject` internal query so actions can reach the Forge-level user row from an auth `subject` claim (no reactive query layer crossing).
- Dashboard now shows a connected-guild banner. Empty state prompts the admin to install the bot; connected state shows the guild icon, name, and a Manage link to Settings.
- `DISCORD_CLIENT_SECRET` and `DISCORD_BOT_PERMISSIONS` in `.env.example`.
- `prds/robel-auth-integration-report.md`: upstream integration report covering versions, timeline, root causes, patches applied, and recommended fixes for `@robelest/convex-auth`. Written for the maintainer to read.
- Access control gate: `convex/lib/access.ts` ships `isAllowedEmail` and `roleForEmail` so every future mutation shares a single policy. Only `@convex.dev` emails are admitted; `wayne@convex.dev` is always the workspace `owner`, everyone else is `admin`. Email + profile are read from Robel's component via `auth.user.viewer(ctx)`; the JWT only carries `sub`.
- `src/hooks/useAutoSignOut.ts`: guarded one-shot effect hook that calls `signOut()` when a session is confirmed denied, so `/auth/denied` no longer triggers a continuous Robel refresh loop.
- `api.users.access` probe query returning `{ authenticated, allowed, email? }`. Purely reads JWT claims; no DB access; safe to call before a user row exists.
- `AccessDenied.tsx` page at `/auth/denied`: window-chrome denial screen for authenticated GitHub accounts without a `@convex.dev` email, with a sign-out affordance.
- ESLint flat config `eslint.config.js` wiring `@convex-dev/eslint-plugin` recommended + type-aware rules for `convex/**`, plus `typescript-eslint` and `eslint-plugin-react-hooks` for `src/**`. New `npm run lint:code` script.

### Changed

- `src/pages/EditForm.tsx` now makes the save flow clearer. `Save draft` is explicitly a Convex only save, `Update Discord command` makes it clear the live slash command is being synced, and warning states now explain unsaved edits versus saved but unsynced command settings.
- `src/pages/EditForm.tsx` now includes access and submission rule controls for required roles, blocked roles, lifetime caps, daily caps, and the Discord success message shown after submit.
- `convex/http.ts` now blocks form use when a member lacks required roles or has blocked roles, and returns clear ephemeral errors when lifetime or daily submission caps are hit.
- `src/pages/EditForm.tsx` now includes routing controls in the command pane, a guild channel refresh action, per form approval and destination channel selectors, forum tag selection, and a direct link to results.
- `src/pages/Settings.tsx` now does more than connect and disconnect servers. Each connected guild can refresh its channel cache and save default approval and destination channels that future forms inherit.
- `src/pages/Forms.tsx` cards now link to both the editor and the per form results page so admins can move between building and review without hunting through routes.
- `src/App.tsx` now includes the `/app/forms/:formId/results` route in the protected workspace tree.
- `src/pages/EditForm.tsx` now behaves like a real workspace instead of a long settings page. Command settings, modal fields, and Discord preview each have Phosphor icons, can be toggled independently for more room, adapt to mobile with a pane switcher, and keep save and publish controls in a compact top toolbar.
- `src/styles/index.css` now gives the app shell a softer, more intentional background treatment so the editor reads as a flagship builder surface rather than a flat beige document.
- `convex/http.ts` now handles the first real Discord runtime path after publish: verified application-command interactions open a modal from the saved form fields, and verified modal submits write a `submissions` row then return an ephemeral acknowledgement instead of the old 501 response.
- `src/pages/Forms.tsx` cards now open the editor route, and `src/pages/NewForm.tsx` now lands on the editor immediately after draft creation so admins can keep building without bouncing back through the list.
- `src/pages/Settings.tsx` now lets admins disconnect a connected server with an inline confirm state, loading feedback, and a success banner. The Connect action is temporarily disabled while a disconnect is in flight so the page only runs one server mutation at a time.
- `convex/schema.ts` adds `submissions.by_guild` so guild disconnect cleanup can delete server-scoped submission rows with an indexed query.
- `convex/schema.ts` now allows draft forms to omit `destinationChannelId` and `destinationType` until the routing tab lands. This avoids stuffing fake channel IDs into unpublished rows and keeps draft creation honest.
- `convex/discord.ts` now defaults `DISCORD_BOT_PERMISSIONS` to `328565051456`, matching the seven permissions Forge actually needs: View Channels, Send Messages, Manage Messages, Embed Links, Manage Threads, Create Public Threads, and Send Messages in Threads.
- Dashboard now links to `/app/forms` and surfaces the form-builder shell as the next Phase 2 step, not just Discord settings.
- `/app/forms` now exposes a live `New form` action when a guild is connected, and `/app/forms/new` provides the first interactive builder step instead of the earlier placeholder button.
- `useEnsureAppUser` now reads `api.users.access` first and only queries `api.users.me` / runs `upsertFromIdentity` when the email gate returns true. Denied accounts hit zero extra Convex reads.
- `Protected.tsx` has a three-way outcome: hydrating spinner, redirect to `/auth/sign-in`, redirect to `/auth/denied`, or render the workspace.
- `convex/users.ts:upsertFromIdentity` throws `ConvexError("access_denied")` for non-`@convex.dev` identities and no longer depends on "first user becomes owner". `ctx.db.patch` now uses the explicit-table-name form (`ctx.db.patch("users", id, ...)`) per Convex 1.31 guidance; ESLint `@convex-dev/explicit-table-ids` is wired to catch regressions.

### Fixed

- Editor pane overlap at large widths. `src/pages/EditForm.tsx` now adds the width constraints missing from pane shells, labels, and field cards so command pane inputs stay inside their own column instead of spilling across adjacent panes.
- `@convex.dev` accounts were being denied. Root cause: Robel issues JWTs that only carry `sub`; email, name, and picture live in the auth component's `User` table and are not in the token. `ctx.auth.getUserIdentity().email` is therefore always `undefined`, and `isAllowedEmail(undefined)` returned false for everyone. Switched `access`, `me`, and `upsertFromIdentity` in `convex/users.ts` to read `auth.user.viewer(ctx)`, which fetches the canonical Robel user doc. Dropped `requireAllowedIdentity` from `convex/lib/access.ts` since the email source moved.
- Refresh storm on `/auth/denied` (~2 `auth:signIn`/`auth:store` calls per second for the life of the tab). Denied sessions now call `signOut()` exactly once on mount via a new `useAutoSignOut` hook, which clears the token and stops the Robel client from auto-refreshing. The denial page latches the email into component state before signout so the message survives the unauthenticated re-render.
- Convex rejected the Robel-issued JWT with `No auth provider found matching the given token (no providers configured).` Added `convex/auth.config.ts` pointing at `domain: process.env.CONVEX_SITE_URL`, `applicationID: "convex"` so Convex resolves the JWKS at `${CONVEX_SITE_URL}/.well-known/jwks.json` and trusts Robel's `iss`/`aud` pair.
- GitHub sign-in was failing with `OAUTH_PROVIDER_ERROR: Missing or invalid 'expires_in' field`. Root cause: `@robelest/convex-auth@0.0.4-preview.27` calls arctic's `OAuth2Tokens.accessTokenExpiresAt()` unconditionally inside `normalizeTokens`, and arctic throws whenever the OAuth response lacks `expires_in` (GitHub OAuth Apps never include it). Patched via `patches/@robelest+convex-auth+0.0.4-preview.27.patch` to wrap the call in a try/catch. `.28` and `.29` were attempted but ship a broken `workspace:*` dependency that npm refuses. Added `patch-package` as a dev dep and a `postinstall` script so the fix survives `npm install`. Remove the patch once Robel ships a release that guards the call internally.

### Known (triaged by convex-doctor, score 90 Healthy)

- `config/missing-auth-config`: false positive. Robel auth uses `createAuth(components.auth, ...)` and does not read `convex/auth.config.ts`.
- `correctness/generated-code-modified`: false positive. `convex/_generated/` is gitignored and regenerated by `convex dev`, not hand-edited.
- `security/missing-auth-check` on `upsertFromIdentity`: false positive. The handler resolves `auth.user.viewer(ctx)` and `ctx.auth.getUserIdentity()` before any DB access. The static check cannot trace helpers.
- Pre-existing schema warnings (`index-name-includes-fields`, `missing-index-on-foreign-key`, `redundant-index`) scoped to Phase 2 table work and tracked in `TASK.md`.

### Pre-existing (not changed today)

- Vite + React 19 + Tailwind v4 project scaffold: `index.html`, `vite.config.ts`, `tsconfig.{json,app,node}.json`, `src/main.tsx`, `src/App.tsx`, `src/styles/index.css` with Forge `@theme` tokens.
- Convex backend scaffold: `convex/convex.config.ts` registers `@robelest/convex-auth` and `@convex-dev/static-hosting`; `convex/schema.ts` implements the full PRD data model; `convex/http.ts` wires `auth.http.add`, Discord `/interactions` with Ed25519 verify + PING response, and `registerStaticRoutes`.
- Robel auth bootstrap in `convex/auth.ts`: `createAuth(components.auth, { providers: [github(...)] })` using the first-party provider factory.
- Static-hosting internal API in `convex/staticHosting.ts`: `generateUploadUrl`, `recordAsset`, `gcOldAssets`, `listAssets`, `getCurrentDeployment`.
- App-level user mirror in `convex/users.ts`: `me` query and `upsertFromIdentity` mutation keyed by the auth `subject`, first user becomes owner.
- `.env.example` covering Convex, Discord, GitHub, and Robel auth env vars.
- `package.json` with the full dependency surface, `overrides` pinning `effect` to `4.0.0-beta.43`, and a `deploy` script pointing at `npx @convex-dev/static-hosting deploy`.
- Shared client singletons: `src/lib/convex.ts` (ConvexReactClient) and `src/lib/auth.ts` (Robel browser client) so every query, mutation, and OAuth call share one WebSocket and one token state.
- Reactive auth hook `src/hooks/useAuth.ts` backed by `useSyncExternalStore` (react-effect-decision rule 7) over Robel's `auth.onChange` + `auth.state`.
- Focused sync hook `src/hooks/useEnsureAppUser.ts` isolating the single legitimate external-sync effect (upserting the app-level `users` row after OAuth redirect).
- Typed outlet-context reader `src/hooks/useMe.ts` so `/app/*` pages read the current user without re-querying Convex.
- Sign-in screen `src/components/auth/SignIn.tsx` with a window-chrome card, single GitHub OAuth button, pending + error states, and auto-redirect when already authenticated.
- Route gate `src/components/auth/Protected.tsx` that shows a spinner during hydration, redirects to `/auth/sign-in` when unauthenticated, calls `upsertFromIdentity` on first sign-in, and exposes the current user via a `useMe()` hook backed by `useOutletContext`.
- Placeholder dashboard `src/pages/Dashboard.tsx` at `/app` showing name, email, avatar, role, and a sign-out button.
- `BrowserRouter` wiring in `src/App.tsx`: `/` redirects to `/app`, `/auth/sign-in` renders the sign-in card, `/auth/denied` renders the access-denied page, `/app` is gated by `<Protected />`, and any unknown path falls back to `/`.

### Pending

- Run `npx @robelest/convex-auth` to generate `JWT_PRIVATE_KEY` and `JWKS`, then set them via `npx convex env set`.
- Populate `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `DISCORD_*` env vars before the first end-to-end sign-in.
- Deploy with `npx @convex-dev/static-hosting deploy` and confirm the Convex site URL resolves.

## [0.1.1] - 2026-04-17

### Changed

- Swapped auth provider from Better Auth to `@robelest/convex-auth`. PRD now documents the Robel CLI wizard, `createAuth(components.auth, ...)`, and the `OAuth(...)` + `arctic` GitHub pattern.
- Pinned frontend hosting to the `@convex-dev/static-hosting` Convex component. Replaced generic "Convex static hosting" references in PRD sections 1, 3, 4, 12, and 17.
- Replaced Lucide with Phosphor Icons (`@phosphor-icons/react`). Added to tech stack table and stack header.
- Updated `users` schema: replaced `githubId` + `by_github` index with `subject` + `by_subject`, and renamed `avatarUrl` to `image` to match Robel auth profile output.
- Rewrote PRD section 9 (auth flow) around `auth.http.add(http)`, the Robel auth client, and the installed-package reality check from the `robel-auth` skill.
- Updated environment variables in PRD section 11 to Robel conventions (`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `JWT_PRIVATE_KEY`, `JWKS`) and added `SITE_URL`.
- Updated PRD section 15 file structure to include `convex/convex.config.ts`, `convex/staticHosting.ts`, `convex/users.ts`, and the root-level `files.md`, `changelog.md`, `TASK.md` trackers.
- Updated PRD section 16 Cursor prompt to reference the Robel auth and static-hosting CLIs.
- Updated PRD section 17 references: added Robel auth docs and source, static-hosting component and source, Phosphor Icons and `@phosphor-icons/react`. Removed the Better Auth link.
- Refreshed PRD section 13 CSRF note to reference Robel auth defaults.

### Added

- `files.md` at repo root. Live index of every file with status flags.
- `changelog.md` at repo root. This file.
- `TASK.md` at repo root. Phase-by-phase task checklist mirroring PRD section 12.
