# Forge setup guide

Everything you need to run Forge against any Discord server. Written for a first-time developer setting this up end to end.

Forge is a self-hostable Discord form builder and approval engine. You design forms in a web dashboard, publish each one as a slash command, collect submissions through native Discord modals, optionally route them through a mod queue, and publish approved answers into any text or forum channel. Real time end to end via Convex.

> Heads up: this repo is the same code that powers Convex's internal Forge instance. Sign in on that hosted deployment is locked to `@convex.dev` email addresses and will reject everyone else. To run Forge for your own Discord server, fork https://github.com/waynesutton/forge-for-discord, deploy your own Convex project, and follow this guide end to end. Every step below assumes you are running your own fork, not the Convex-hosted instance.

## Contents

- What Forge is
- Features at a glance
- Architecture
- Prerequisites
- Install the code
- Set up Convex
- Set up the Discord application
- Bot permissions and scopes
- Invite the bot into a server
- Set up auth (Robel Convex Auth + GitHub)
- Admin access and how to add admins
- Environment variables
- Go from localhost to production
- Deploy to production on Convex static hosting
- In-app docs section
- Troubleshooting
- References

## What Forge is

Forge is a single-deployment Discord app. Backend, frontend, file storage, auth, and cron jobs all live inside one Convex project. There is no separate worker process and no webhook server to run. Everything Discord posts hits `/interactions` on your Convex site URL, runs through an Ed25519 signature check, and writes reactive data back to the dashboard.

The people who use Forge sign in at the web dashboard, design forms visually, and watch submissions arrive in real time. The people who submit the forms never leave Discord.

## Features at a glance

Form builder

- Visual form editor with a live Discord modal preview
- Field types: short text, paragraph, email (private by default), code block with copy, single select, yes or no, checkbox, and number with min, max, and currency unit
- Per field helper text, required toggle, placeholder, min and max length, and option validation for select, yes_no, and checkbox

Slash commands

- Publish each form as a guild slash command in one click
- Name validation, command description, and Discord sync from the editor

Access gates

- Required, blocked, and moderator role gates read from the cached guild roles
- Per user and per day submission caps
- Custom success messages shown to the submitter

Moderation

- Optional mod queue with Approve and Deny buttons posted to Discord
- Approve and Deny mirrored on the web dashboard so mods can work in either place
- Deny reason modal with a 500 character cap
- Moderator name in the embed footer toggle

Publishing

- Publish into text channels or forum threads with a title template
- Apply forum tags on publish
- Optional submitter link prepended to the post with no ping
- Private fields such as email stripped from public embeds but kept in mod queue and dashboard views

Ticket mode

- Lifecycle buttons on published posts: claim, unclaim, resolve, reopen, close
- Separate role pickers for claim and resolve, plus admin and mod fallback
- Auto close after N days of inactivity, swept every hour by cron
- Forum threads archive on close and unarchive on reopen

Results and audit

- Per form results page with status pills, copy buttons, and a pending review surface
- Hide or delete rows with optional Discord message cleanup on delete
- Reply in Discord composer that posts a bot authored message into the published thread or channel
- CSV and PDF export for submissions
- Per form audit log with plain English hints for Discord REST errors

Infrastructure

- Type safe end to end from Convex queries to React UI
- Reactive subscriptions, no polling
- Ed25519 signature verification on every Discord interaction
- Static frontend hosted on Convex via `@convex-dev/static-hosting`

## Architecture

One Convex deployment holds the whole app:

- `convex/http.ts` handles `POST /interactions` for Discord and `GET /api/discord/install` for the OAuth bot install flow. It also registers `@convex-dev/static-hosting` routes that serve the React bundle.
- `convex/discord.ts` is a Node action module with the Discord REST helpers used by the scheduler.
- `convex/schema.ts` owns nine tables: `users`, `guilds`, `guildChannels`, `guildRoles`, `forms`, `submissions`, `auditLog`, `cooldowns`, and `oauthStates`.
- `convex/crons.ts` runs the hourly auto close sweep.
- The frontend is a Vite React 19 app shipped to the same Convex site URL. It talks to Convex through reactive `useQuery`, `useMutation`, and `useAction` hooks.

Discord posts interactions to `https://<your-deployment>.convex.site/interactions`. The app is served from the same host at `/` once you deploy static hosting.

## Prerequisites

You need:

- Node 20 or newer
- A Convex account and the Convex CLI
- A Discord account with permission to create a Discord application
- Admin access to a Discord server you can test against (a private test server is fine)
- A GitHub account to register the OAuth App that Robel Convex Auth signs users in with. Every admin of your Forge install also needs a GitHub account whose primary email lands on the allowlist.

## Install the code

```bash
git clone <your fork of the repo>
cd opportuities-bot
npm install
cp .env.example .env.local
```

`npm install` auto applies the `@robelest/convex-auth` patch through `postinstall`. The patch file at `patches/@robelest+convex-auth+0.0.4-preview.27.patch` fixes a GitHub token exchange bug in upstream preview.27 and must stay applied. Do not delete it.

## Set up Convex

1. Run `npx convex dev` in the project root.
2. Choose "create a new project" on first run. Convex prints two URLs:
   - `VITE_CONVEX_URL` (the `*.convex.cloud` URL used by the client)
   - Site URL (`*.convex.site` used by Discord and static hosting)
3. Paste `VITE_CONVEX_URL` into `.env.local`.
4. Keep `npx convex dev` running. It generates `convex/_generated/api.ts` and live pushes schema changes.

Your dev deployment prints something like `https://your-dev-deployment.convex.site` (Convex assigns a unique `<animal-name-1234>.convex.site` domain per deployment). Keep this URL handy, it is what you paste into Discord, GitHub OAuth, and `SITE_URL`. The production target will print a different `*.convex.site` URL once you run `npx convex init --prod` in the deploy step below.

## Set up the Discord application

Keep two Discord applications, one for dev and one for prod. Mixing them is the single most common cause of lost tokens and failed signature checks.

1. Go to https://discord.com/developers/applications and click **New Application**. Name it "Forge (dev)" for your dev deploy.
2. On **General Information** copy:
   - **Application ID** into Convex env as `DISCORD_APPLICATION_ID`
   - **Public Key** into Convex env as `DISCORD_PUBLIC_KEY`
3. On **OAuth2** copy **Client Secret** into Convex env as `DISCORD_CLIENT_SECRET`. Click Reset Secret if you need a fresh one.
4. Open **Bot**, click **Add Bot**, then **Reset Token**. Copy the value into Convex env as `DISCORD_BOT_TOKEN`. Discord only shows it once.
5. Leave every **Privileged Gateway Intent** off. Forge never uses the gateway.

Set the interactions endpoint:

1. Scroll to **Interactions Endpoint URL** on **General Information**.
2. Paste `<your convex site url>/interactions`. Example:

```
https://your-dev-deployment.convex.site/interactions
```

3. Click **Save Changes**. Discord sends a verification PING and only accepts the URL if the Ed25519 check passes.

Set the OAuth2 redirect URI on the same Discord app:

1. Open **OAuth2 > General**.
2. Add redirect `<your convex site url>/api/discord/install`.
3. Click **Save Changes**.

Set the Convex env values now so the PING check can pass:

```bash
npx convex env set DISCORD_APPLICATION_ID <value>
npx convex env set DISCORD_PUBLIC_KEY <value>
npx convex env set DISCORD_BOT_TOKEN <value>
npx convex env set DISCORD_CLIENT_SECRET <value>
```

Optional override for the invite bitmask:

```bash
npx convex env set DISCORD_BOT_PERMISSIONS 328565051456
```

For production repeat the same commands with `--prod` on a separate Discord app.

## Bot permissions and scopes

Forge ships with this default bitmask, set in `convex/discord.ts`:

```
DEFAULT_PERMISSIONS = "328565051456"
```

That value is the sum of these seven permission bits:

| Bit | Value | Permission | Why |
|---|---|---|---|
| 10 | 1,024 | View Channels | List channels, roles, forum tags |
| 11 | 2,048 | Send Messages | Post to mod queue and text destinations |
| 13 | 8,192 | Manage Messages | Edit mod queue message after Approve or Deny |
| 14 | 16,384 | Embed Links | Render submission embeds |
| 34 | 17,179,869,184 | Manage Threads | Apply forum tags and edit threads |
| 35 | 34,359,738,368 | Create Public Threads | Publish to Forum channels |
| 38 | 274,877,906,944 | Send Messages in Threads | Post inside forum threads |

OAuth scopes, separate from permissions:

- `bot`
- `applications.commands`

Voice permissions: none. Forge never touches voice.

Message Content Intent: off. Forge never reads free form messages.

If a server admin insists on the Use Slash Commands bit, set `DISCORD_BOT_PERMISSIONS=330712535104` which adds bit 31 (`2,147,483,648`). The `applications.commands` scope usually makes that redundant.

## Invite the bot into a server

You never paste an invite URL by hand. Forge mints a signed one for you.

1. Start the frontend: `npm run dev`.
2. Sign in at `/` (the homepage is the sign-in screen).
3. Open `/app/settings` and click **Connect server**.
4. The action `api.discord.generateInstallUrl` mints a CSRF nonce, stores it in the `oauthStates` table with a 10 minute TTL, and redirects you to Discord with the bitmask, scopes, and `state=<nonce>` baked in.
5. Pick the server, confirm the permissions, click Authorize.
6. Discord redirects to `<convex site>/api/discord/install?code=...&state=...&guild_id=...`.
7. The HTTP callback verifies the nonce, exchanges the code for an access token, writes a `guilds` row, and redirects to `/app/settings?installed=<guildId>` on success or `/app/settings?error=<code>` on failure.

`/app` shows a connected guild banner once the row lands. `/app/settings` lists the guild with a disconnect button.

## Set up auth (Robel Convex Auth + GitHub)

Forge signs admins in with [`@robelest/convex-auth`](https://github.com/robelest/convex-auth/) using GitHub as the only OAuth provider. The auth component lives entirely inside the Convex deployment, so there is no separate identity vendor to configure.

**How the flow works**

1. An admin opens Forge at `/`. The home route renders the sign-in screen.
2. Clicking **Continue with GitHub** calls the Robel browser client, which redirects to GitHub with state and PKCE.
3. GitHub redirects back to `<your convex site url>/.auth/callback/github`. The Robel component exchanges the code, reads the user's profile and primary email from GitHub, and writes a session into its own component tables.
4. The component mints a JWT signed with `iss = CONVEX_SITE_URL` and `aud = "convex"`. The browser stores it in `localStorage` under a namespaced key.
5. Every Convex query and mutation runs `requireAllowedViewer(ctx)` (see `convex/lib/auth.ts`). That helper reads the email from `auth.user.viewer(ctx)` (not from `ctx.auth.getUserIdentity()`, which does not carry email on Robel) and checks it against the allowlist in `convex/lib/access.ts`.
6. If the email is allowed, `convex/users.ts` upserts a row into the app-level `users` table and stamps `role: owner | admin`. If it is not allowed, the client is redirected to `/auth/denied` and `useAutoSignOut` immediately signs the Robel session out so Convex stops refreshing the JWT.
7. Signing out clears the local JWT, refresh token, and OAuth verifier, calls the server `signOut` mutation once, and Protected redirects back to `/`.

**Files that matter for auth**

| File | Role |
|---|---|
| `convex/auth.ts` | Calls `createAuth(components.auth, { providers: [github({...})] })` and exports `signIn`, `signOut`, `store` |
| `convex/auth.config.ts` | Tells Convex to trust JWTs with `iss = CONVEX_SITE_URL` and `aud = "convex"` |
| `convex/convex.config.ts` | Registers `@robelest/convex-auth` as a Convex component |
| `convex/http.ts` | `auth.http.add(http)` mounts `/.auth/callback/*`, `/.well-known/jwks.json`, and the refresh endpoints |
| `convex/lib/auth.ts` | `requireAllowedViewer` helper used by every non-auth query and mutation |
| `convex/users.ts` | `access`, `me`, and `upsertFromIdentity` read email via `auth.user.viewer(ctx)` |
| `src/lib/auth.ts` | Builds the browser client and exposes a deterministic `signOutNow()` that avoids refresh-token loops |
| `src/hooks/useAuth.ts` | `useSyncExternalStore` wrapper over the Robel `auth.onChange` stream |
| `src/components/auth/SignIn.tsx` | Homepage sign-in button. Redirects to `/app` when already authenticated |
| `src/components/auth/Protected.tsx` | Route gate. Redirects unauthenticated sessions to `/` and denied sessions to `/auth/denied` |
| `patches/@robelest+convex-auth+0.0.4-preview.27.patch` | Fixes the GitHub `expires_in` bug in upstream preview.27 |

**GitHub OAuth App setup**

Create one OAuth App per deployment (dev and prod) at https://github.com/settings/developers.

1. Click **New OAuth App**. Name it "Forge (dev)" for your dev deploy.
2. **Homepage URL**: `http://localhost:5173` for dev, your prod Convex site URL (looks like `https://your-prod-deployment.convex.site`) for prod.
3. **Authorization callback URL**: set it to `<your convex site url>/.auth/callback/github`.
   - Dev example: `https://your-dev-deployment.convex.site/.auth/callback/github`
   - Prod example: `https://your-prod-deployment.convex.site/.auth/callback/github`
4. Click **Register application**.
5. On the app page, copy the **Client ID** and click **Generate a new client secret**. Copy the secret. GitHub only shows it once.

**Generate Robel keys**

Robel signs JWTs with a local key pair. Generate it once per deployment:

```bash
npx @robelest/convex-auth
```

The CLI writes `JWT_PRIVATE_KEY` and `JWKS` into your Convex deployment env. If the CLI fails or exits quietly, set them by hand from its output:

```bash
npx convex env set JWT_PRIVATE_KEY '<generated private key>'
npx convex env set JWKS '<generated jwks json>'
```

**Set the rest of the auth env on Convex**

```bash
npx convex env set AUTH_GITHUB_ID <github oauth client id>
npx convex env set AUTH_GITHUB_SECRET <github oauth client secret>
npx convex env set SITE_URL http://localhost:5173
npx convex env set OWNER_EMAIL you@yourdomain.com
```

For prod repeat with a separate GitHub OAuth App, the prod site URL, and the owner email pinned on the prod deployment:

```bash
npx convex env set AUTH_GITHUB_ID <prod client id> --prod
npx convex env set AUTH_GITHUB_SECRET <prod client secret> --prod
npx convex env set SITE_URL <your prod convex site url> --prod
npx convex env set OWNER_EMAIL you@yourdomain.com --prod
# Generate fresh keys for prod
npx @robelest/convex-auth --prod
```

`OWNER_EMAIL` is optional. If you leave it unset, Forge falls back to the upstream owner email (`wayne@convex.dev`) and every signed-in `@convex.dev` admin stays on `role: "admin"`. Set it per deployment so the owner follows your team.

Frontend `.env.local` only needs `VITE_CONVEX_URL`. The sign-in flow reads everything else from Convex at runtime.

**Known gotchas**

- `ctx.auth.getUserIdentity().email` is always `undefined` on Robel. Always read email via `await auth.user.viewer(ctx)` instead. See `prds/robel-auth-integration-report.md` for the full write-up.
- If an authenticated session is rejected by the app allowlist, the client will loop `auth:signIn` / `auth:store refreshSession` calls every 500 ms until `auth.signOut()` runs. `src/hooks/useAutoSignOut.ts` handles that for the denied page. Do not remove it.
- `convex/auth.config.ts` reads `CONVEX_SITE_URL` which Convex auto-populates. You do not set that value manually.

## Admin access and how to add admins

Access is gated by email allowlist. Two roles exist:

- `owner`: one deterministic email pinned in code, full access
- `admin`: any other allowlisted email, full access aside from owner-only ops

Everyone else lands on `/auth/denied` with a one-shot sign out so the session does not refresh loop.

The allowlist lives in a single file:

```
convex/lib/access.ts
```

That file exports two pure helpers, `isAllowedEmail(email)` and `roleForEmail(email)`. They read a domain match (`@convex.dev` in the current build) and an owner email pulled from the `OWNER_EMAIL` Convex env var, falling back to `wayne@convex.dev` when unset. Rewrite the file to change the domain rule. Set the env var to change the owner without touching code.

To add an admin for your own Forge install:

1. Open `convex/lib/access.ts`.
2. Change `ALLOWED_EMAIL_SUFFIX` to your company domain (for example `@yourco.com`), or swap the suffix check for an explicit `Set<string>` of addresses.
3. Set the owner via env: `npx convex env set OWNER_EMAIL you@yourco.com` (and the same with `--prod` on your production deployment). If you leave this unset, Forge defaults to the upstream owner email.
4. Save. `npx convex dev` hot reloads the backend.
5. Have the new admin sign in with a matching email. The `users.upsertFromIdentity` mutation creates a `users` row and stamps `role: "admin"` (or `owner` if the email matches `OWNER_EMAIL`).

### Tenancy model and who can see what

Forge is a shared workspace. Every user on the allowlist can see and edit every installed guild, form, and submission. The email allowlist IS the tenancy boundary. If you need per-user or per-team scoping (multi-tenant SaaS, paid tiers, etc.), add a `memberships` table keyed on `{ userId, guildId, role }` and a `requireGuildAccess(ctx, guildId)` helper that every Convex handler calls before reading guild-scoped data. The 2026-04-18 security audit flagged the missing per-user gate as "HIGH IDOR"; it is intentional for this single-team phase of the product. See `prds/security-audit-fixes-2026-04-18.md` for the full disposition.

Files that depend on the access rule:

- `convex/users.ts` reads the role during `access`, `me`, and `upsertFromIdentity`
- `convex/lib/auth.ts` enforces it on every Convex query and mutation through `requireAllowedViewer`
- `src/components/auth/Protected.tsx` routes denied sessions to `/auth/denied`
- `src/hooks/useAutoSignOut.ts` signs denied sessions out once to avoid a refresh loop
- `src/pages/AccessDenied.tsx` renders the denied state
- `prds/access-control.md` documents the current rule

## Environment variables

Frontend `.env.local`:

| Key | Used by | Notes |
|---|---|---|
| `VITE_CONVEX_URL` | `src/lib/convex.ts` | `*.convex.cloud` URL from `npx convex dev` |
| `VITE_CONVEX_SITE_URL` | Sign-in helpers | `*.convex.site` URL. Optional today, handy for copy-paste into the GitHub callback |

Convex deployment env (`npx convex env set`):

| Key | Required | Notes |
|---|---|---|
| `DISCORD_APPLICATION_ID` | yes | Discord app id |
| `DISCORD_PUBLIC_KEY` | yes | Verifies `/interactions` signatures |
| `DISCORD_BOT_TOKEN` | yes | Bot token, never expose to the client |
| `DISCORD_CLIENT_SECRET` | yes | OAuth2 client secret for bot install |
| `DISCORD_BOT_PERMISSIONS` | no | Defaults to `328565051456` |
| `AUTH_GITHUB_ID` | yes | GitHub OAuth App client id for Robel auth |
| `AUTH_GITHUB_SECRET` | yes | GitHub OAuth App client secret |
| `JWT_PRIVATE_KEY` | yes | Set by `npx @robelest/convex-auth`. Do not hand-edit |
| `JWKS` | yes | Set by `npx @robelest/convex-auth`. Do not hand-edit |
| `SITE_URL` | yes | Base URL of the frontend. `http://localhost:5173` in dev, the prod site URL in prod. Also used to pin the `Access-Control-Allow-Origin` header on the Discord OPTIONS preflights |
| `OWNER_EMAIL` | no | Email address that maps to `role: "owner"`. Defaults to the upstream owner when unset. Set per deployment so the owner follows your team |
| `CONVEX_SITE_URL` | auto | Populated by Convex. Read by `convex/auth.config.ts` |

Set the same keys on prod with `--prod`:

```bash
npx convex env set DISCORD_APPLICATION_ID <value> --prod
npx convex env set DISCORD_PUBLIC_KEY <value> --prod
npx convex env set DISCORD_BOT_TOKEN <value> --prod
npx convex env set DISCORD_CLIENT_SECRET <value> --prod
npx convex env set AUTH_GITHUB_ID <value> --prod
npx convex env set AUTH_GITHUB_SECRET <value> --prod
npx convex env set SITE_URL <your prod convex site url> --prod
npx convex env set OWNER_EMAIL you@yourdomain.com --prod
```

## Go from localhost to production

Use this checklist the first time you promote Forge from local dev to the production Convex deploy. Skip the steps you have already done.

### 1. Prove it works on dev first

- `npx convex dev` is running and points at your dev deployment (its site URL looks like `https://your-dev-deployment.convex.site`; grab the real value from the dashboard)
- You can sign in at `http://localhost:5173/` with a GitHub account whose primary email matches `convex/lib/access.ts`
- You can connect a test Discord server, publish a form, and submit it from Discord
- The audit log records the submission and the forum or text post lands in Discord

If any step fails on dev, do not ship. Production will inherit the same bug.

### 2. Create a separate Convex project for prod

Production should never share a deployment with dev. A dropped message on dev should not take down the prod bot.

```bash
npx convex login
npx convex init --prod
```

This writes the prod deploy key into `.env.local` under `CONVEX_DEPLOY_KEY`. The prod deployment gets its own auto-generated `CONVEX_SITE_URL` (shape: `https://<animal-name-1234>.convex.site`). Reference this URL as `<your prod convex site url>` in the steps below.

### 3. Create a second Discord application for prod

Dev and prod must have distinct Discord applications. Dev tokens and public keys cannot sign prod interactions.

- Open https://discord.com/developers/applications
- Click **New Application** and name it something like `Forge Prod`
- Copy `APPLICATION ID`, `PUBLIC KEY`, and reset and copy the bot token
- Set **Interactions Endpoint URL** to `<your prod convex site url>/interactions`
- Add the OAuth redirect `<your prod convex site url>/oauth/callback`
- Generate the install URL with the seven-permission bitmask and `scope=bot applications.commands`

### 4. Create a second GitHub OAuth App for prod

Dev and prod need distinct GitHub OAuth Apps so the callback URL per env stays correct.

- Open https://github.com/settings/developers and click **New OAuth App**
- **Homepage URL**: `<your prod convex site url>`
- **Authorization callback URL**: `<your prod convex site url>/.auth/callback/github`
- Generate a client secret and copy both the client ID and secret

### 5. Set prod env vars on the prod deployment

Every env var uses the same `npx convex env set --prod` pattern. The `--prod` flag targets the production deployment instead of dev.

```bash
npx convex env set --prod DISCORD_APPLICATION_ID <prod app id>
npx convex env set --prod DISCORD_PUBLIC_KEY <prod public key>
npx convex env set --prod DISCORD_BOT_TOKEN <prod bot token>
npx convex env set --prod DISCORD_CLIENT_ID <prod client id>
npx convex env set --prod DISCORD_CLIENT_SECRET <prod client secret>
npx convex env set --prod AUTH_GITHUB_ID <prod github client id>
npx convex env set --prod AUTH_GITHUB_SECRET <prod github client secret>
npx convex env set --prod JWT_PRIVATE_KEY "$(cat jwt-private-key.pem)"
npx convex env set --prod JWKS "$(cat jwks.json)"
npx convex env set --prod SITE_URL <your prod convex site url>
npx convex env set --prod OWNER_EMAIL you@yourdomain.com
```

Reuse the same `JWT_PRIVATE_KEY` and `JWKS` on dev and prod only if you want logged-in dev sessions to carry over. For a clean split, generate a fresh pair with `npx @robelest/convex-auth` and set those on prod only.

### 6. Build against the prod Convex URL

`VITE_CONVEX_URL` is read at build time. The `deploy` script in `package.json` reads the prod URL automatically when you run:

```bash
npm run deploy
```

This runs `npx @convex-dev/static-hosting deploy` which:

1. Runs `npx convex deploy` against the prod deployment.
2. Builds the Vite frontend with the prod `VITE_CONVEX_URL`.
3. Uploads `dist/` to Convex storage and garbage-collects older bundles.

### 7. Smoke test the prod deployment

- Open `<your prod convex site url>/` in an incognito window
- Sign in with a GitHub account whose primary email matches the allowlist
- Go to Settings, click **Connect Discord server**, complete the OAuth install
- Publish a form and submit from the Discord server
- Confirm the audit log entry and the forum or text post

If the Discord slash command does not appear, open the form editor and click **Update Discord command**. Discord propagates command changes in seconds for a registered application, but the first publish per command can take a few minutes.

### 8. Roll over secrets if you ever need to

- Rotate the Discord bot token in the Discord developer portal, then `npx convex env set --prod DISCORD_BOT_TOKEN ...`
- Rotate the GitHub OAuth secret in GitHub, then `npx convex env set --prod AUTH_GITHUB_SECRET ...`
- To regenerate the JWT keypair run `npx @robelest/convex-auth` again and set `JWT_PRIVATE_KEY` and `JWKS`. Every signed-in admin must sign in again after this.

Never commit any of these values. `.env.local` is git-ignored for a reason.

## Deploy to production on Convex static hosting

Forge ships the React bundle through `@convex-dev/static-hosting`. Backend and frontend live on the same Convex site URL, no separate Vercel or Netlify required. See the component overview at https://www.convex.dev/components/static-hosting for how it works.

Reference your own Convex site URLs throughout this section:

- Dev deploy: `<your dev convex site url>` (shape: `https://<animal-name-1234>.convex.site`)
- Prod deploy: `<your prod convex site url>` (created when you run `npx convex init --prod`)

Convex assigns a unique `*.convex.site` domain per deployment. You can find the exact string in the Convex dashboard under Settings for each deployment.

Confirm the component is registered. `convex/convex.config.ts` should already contain:

```ts
import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";

const app = defineApp();
app.use(staticHosting);
export default app;
```

Confirm the routes are mounted. `convex/http.ts` should call `registerStaticRoutes(http, components.selfHosting)`. Confirm the upload API is exposed in `convex/staticHosting.ts` via `exposeUploadApi(...)` and a `getCurrentDeployment` query via `exposeDeploymentQuery(...)`.

Then deploy:

```bash
npx convex login
npm run deploy
```

`npm run deploy` runs `npx @convex-dev/static-hosting deploy` which does three things in order:

1. Builds the frontend with the production `VITE_CONVEX_URL` so the bundle points at the prod backend.
2. Runs `npx convex deploy` to push schema, functions, and HTTP routes to prod.
3. Uploads the built `dist/` files to Convex storage through the internal upload API, garbage collecting older deployment files.

After the first successful run, your prod Convex site URL serves the app. Open it, sign in, and connect a prod Discord server against the prod Discord application.

Live reload on deploy: the app can show an update banner whenever a newer deployment lands. Wire `<UpdateBanner>` from `@convex-dev/static-hosting/react` against the `getCurrentDeployment` query for that.

## In-app docs section

The web app ships a public docs surface at `/docs` (deep link `/docs/:slug`). Anyone evaluating Forge can read the setup guide without signing in, and the sign-in card at `/` links to it directly. Logged-in admins see the same content with a "Back to dashboard" link and the Forms/Docs/Settings tabs; the render is identical otherwise.

The docs page mirrors this guide section by section and ships a Copy markdown button and a Copy link button beside every section so you can paste a link or snippet into a review or a ticket. It is read-only and never exposes write actions.

Use the in-app version when you want the copy-markdown helper. Use this file on disk as the source of truth and reference it from PRs.

## Troubleshooting

**Interactions Endpoint URL could not be validated**
- `DISCORD_PUBLIC_KEY` is missing or does not match the portal
- URL points at `.convex.cloud` instead of `.convex.site`
- Dev deploy is paused; run `npx convex dev`

**Callback lands on `/app/settings?error=invalid_state`**
- CSRF nonce expired (10 minute TTL) or was already consumed
- Click Connect server and complete the flow in one pass

**Callback lands on `/app/settings?error=discord_missing_guild`**
- The OAuth request dropped the `bot` scope. Make sure `generateInstallUrl` still sends `scope=bot applications.commands`

**Callback lands on `/app/settings?error=server_not_configured`**
- One of `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID` is missing in Convex env

**Allowlisted email still lands on `/auth/denied`**
- The GitHub account's primary email does not match the domain in `convex/lib/access.ts`. Set a matching primary email in GitHub account settings and sign in again
- `AUTH_GITHUB_ID` or `AUTH_GITHUB_SECRET` was rotated without updating Convex env
- `JWT_PRIVATE_KEY` or `JWKS` were regenerated mid-session. Sign out of the browser and sign back in

**Sign-in button spins then fails with `OAUTH_PROVIDER_ERROR`**
- The GitHub OAuth App callback URL does not end in `/.auth/callback/github`. Update it in GitHub, no Convex env change needed
- The Robel patch at `patches/@robelest+convex-auth+0.0.4-preview.27.patch` was not applied. Run `npm install` to let `patch-package` reapply it

**Convex logs show repeating `auth:signIn` + `auth:store refreshSession`**
- A denied session is not signing itself out. Confirm `src/hooks/useAutoSignOut.ts` is still imported by `src/pages/AccessDenied.tsx`

**Bot is in the server but the slash command does not appear**
- The form is in draft. Open the editor and click Update Discord command
- The bot lacks `applications.commands` scope. Reinstall it from `/app/settings`

**Discord REST error codes surfaced in the audit log**
- `10003` unknown channel: the destination channel was deleted or moved. Pick a new one in the form editor
- `50001` missing access: add the bot to the target channel
- `50013` missing permissions: grant the missing permission from the table above
- `50035` invalid form body: the title template or embed contents exceed Discord limits
- `160002` max active threads: archive old forum threads or lower the form's daily cap

## References

- Forge source code: https://github.com/waynesutton/forge-for-discord
- Discord developer portal: https://discord.com/developers/applications
- Discord bots overview: https://docs.discord.com/developers/bots/overview
- Discord developer reference: https://docs.discord.com/developers/reference
- Discord API docs repo: https://github.com/discord/discord-api-docs
- Discord bots guide: https://docs.discord.com/developers/guides/bots
- Discord permission bitmask reference: https://discord.com/developers/docs/topics/permissions
- Convex static hosting component: https://www.convex.dev/components/static-hosting/static-hosting.md
- Convex HTTP actions: https://docs.convex.dev/functions/http-actions
- Convex dev workflow: https://docs.convex.dev/understanding/workflow
- Robel Convex Auth repo: https://github.com/robelest/convex-auth/
- Robel Convex Auth docs: https://auth.estifanos.com/getting-started/installation/
- GitHub OAuth Apps: https://github.com/settings/developers
- Robel integration notes: `prds/robel-auth-integration-report.md`
- Forge PRD: `prds/forge-prd_1.md`
- Access control PRD: `prds/access-control.md`
- Discord app walkthrough: `docs/discord-setup.md`
