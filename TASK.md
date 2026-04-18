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
- [ ] PostHog design refinement pass on every surface
- [ ] Loading skeletons and error states

### Phase 6: Production (day 6-7)

- [ ] Custom domain via Convex
- [ ] Production Discord application separate from dev
- [ ] README with install, env vars, and deploy instructions
- [ ] Rate limit abuse test
- [ ] Signature verify fuzz test

## Completed

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
