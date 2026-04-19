import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router";
import {
  ArrowLeft,
  CheckCircle,
  Copy,
  FileText,
  Gear,
  GithubLogo,
  Link as LinkIcon,
  Lightning,
} from "@phosphor-icons/react";
import type { ProtectedContext } from "../hooks/useMe";
import { useAuth } from "../hooks/useAuth";
import { WindowTabs } from "../components/window/WindowTabs";

// In-app docs page. Each section ships a raw markdown string that is both
// rendered into JSX via the small renderer below and exposed through a
// Copy markdown button. The canonical on-disk version lives at
// `docs/setup-guide.md`; keep the two in sync when you edit copy.

type Section = {
  slug: string;
  category: string;
  label: string;
  title: string;
  summary: string;
  markdown: string;
};

// Generic placeholders. Convex assigns a unique `<animal-name-1234>.convex.site`
// URL per deployment, so we never hardcode real values into the docs; the
// reader substitutes their own. This mirrors the convention used on the
// Static Hosting component page: https://www.convex.dev/components/static-hosting
const DEV_SITE_URL = "https://your-dev-deployment.convex.site";
const PROD_SITE_URL = "https://your-prod-deployment.convex.site";

const SECTIONS: Array<Section> = [
  {
    slug: "overview",
    category: "Start here",
    label: "Overview",
    title: "What Forge is",
    summary: "One deployment, one dashboard, no extra worker process.",
    markdown: `## What Forge is

Forge is a self-hostable Discord form builder and approval engine. Design forms in a web dashboard, publish each one as a slash command, collect submissions through native Discord modals, route to a mod queue if you want, and publish approved answers into any text or forum channel. Real time end to end.

One Convex deployment holds everything: backend, frontend, file storage, auth, cron. No separate worker. No webhook server. Discord posts to \`/interactions\` on your Convex site URL, Ed25519 verifies, writes land in the dashboard instantly.

Admins use the dashboard. Submitters never leave Discord.

> Internal app note: the repo at https://github.com/waynesutton/forge-for-discord is the same code that runs Convex's internal Forge instance. Sign in on that hosted deployment is locked to \`@convex.dev\` emails and will reject anyone else. To run Forge for your own Discord server, fork the repo, deploy your own Convex project, and follow this guide end to end.`,
  },
  {
    slug: "features",
    category: "Start here",
    label: "Features",
    title: "Features at a glance",
    summary: "Everything that ships in the current build.",
    markdown: `## Features at a glance

**Form builder**
- Visual editor with a live Discord modal preview
- Field types: short text, paragraph, email (private by default), code block with copy, single select, yes or no, checkbox, and number with min, max, and currency unit
- Per field helper text, required toggle, placeholder, min and max length, option validation

**Slash commands**
- Each form publishes as a guild slash command in one click
- Name validation, description, and Discord sync from the editor

**Access gates**
- Required, blocked, and moderator role gates sourced from the cached guild roles
- Per user and per day submission caps
- Custom success messages shown to the submitter

**Moderation**
- Optional mod queue with Approve and Deny buttons in Discord
- Approve and Deny mirrored on the results page so mods can work in either place
- Deny reason modal capped at 500 chars
- Moderator name in embed footer toggle

**Publishing**
- Publish into text channels or forum threads with a title template
- Apply forum tags on publish
- Optional submitter link prepended to the post, no ping
- Private fields such as email stripped from public embeds, kept in mod queue and dashboard

**Ticket mode**
- Lifecycle buttons on published posts: claim, unclaim, resolve, reopen, close
- Separate role pickers for claim and resolve plus admin and mod fallback
- Auto close after N days of inactivity, swept hourly by cron
- Forum threads archive on close, unarchive on reopen

**Results and audit**
- Per form results page with status pills, copy buttons, pending review surface
- Hide or delete rows with optional Discord message cleanup on delete
- Reply in Discord composer that posts a bot-authored message into the published thread or channel
- CSV and PDF export
- Per form audit log with plain English hints for Discord REST errors

**Infrastructure**
- Type safe end to end from Convex queries to React UI
- Reactive subscriptions, no polling
- Ed25519 signature verification on every Discord interaction
- Static frontend hosted on Convex via \`@convex-dev/static-hosting\``,
  },
  {
    slug: "architecture",
    category: "Start here",
    label: "Architecture",
    title: "How the pieces fit",
    summary: "Where Convex, Discord, and the frontend meet.",
    markdown: `## Architecture

One Convex deployment owns the whole app.

- \`convex/http.ts\` handles \`POST /interactions\` for Discord and \`GET /api/discord/install\` for the OAuth bot install flow. It also registers \`@convex-dev/static-hosting\` routes that serve the React bundle.
- \`convex/discord.ts\` is a Node action module with the Discord REST helpers used by the scheduler.
- \`convex/schema.ts\` owns nine tables: \`users\`, \`guilds\`, \`guildChannels\`, \`guildRoles\`, \`forms\`, \`submissions\`, \`auditLog\`, \`cooldowns\`, and \`oauthStates\`.
- \`convex/crons.ts\` runs the hourly auto close sweep.
- The frontend is a Vite React 19 app shipped to the same Convex site URL. It talks to Convex through reactive \`useQuery\`, \`useMutation\`, and \`useAction\` hooks.

Discord posts interactions to \`https://<your deployment>.convex.site/interactions\`. The app is served from the same host at \`/\` once you deploy static hosting.`,
  },
  {
    slug: "prerequisites",
    category: "Setup",
    label: "Prerequisites",
    title: "What you need before you start",
    summary: "Accounts, tools, and one test server.",
    markdown: `## Prerequisites

You need:

- Node 20 or newer
- A Convex account and the Convex CLI
- A Discord account with permission to create an application
- Admin access to a Discord server you can test against. A private test server is fine.
- A GitHub account to register the OAuth App for Robel Convex Auth. Every admin also needs a GitHub account whose primary email matches the allowlist.`,
  },
  {
    slug: "install",
    category: "Setup",
    label: "Install the code",
    title: "Install the code",
    summary: "Clone, install, copy env.",
    markdown: `## Install the code

\`\`\`bash
git clone <your fork>
cd opportuities-bot
npm install
cp .env.example .env.local
\`\`\`

\`npm install\` auto applies the \`@robelest/convex-auth\` patch through \`postinstall\`. The patch at \`patches/@robelest+convex-auth+0.0.4-preview.27.patch\` fixes a GitHub token exchange bug in upstream preview.27 and must stay applied.`,
  },
  {
    slug: "convex",
    category: "Setup",
    label: "Set up Convex",
    title: "Set up Convex",
    summary: "One CLI command gets you two URLs.",
    markdown: `## Set up Convex

1. Run \`npx convex dev\` in the project root.
2. Choose "create a new project" on first run. Convex prints two URLs:
   - \`VITE_CONVEX_URL\` (the \`*.convex.cloud\` URL used by the client)
   - Site URL (\`*.convex.site\` used by Discord and static hosting)
3. Paste \`VITE_CONVEX_URL\` into \`.env.local\`.
4. Keep \`npx convex dev\` running. It generates \`convex/_generated/api.ts\` and live pushes schema changes.

Convex assigns a unique \`*.convex.site\` domain per deployment (shape: \`${DEV_SITE_URL}\` for dev, \`${PROD_SITE_URL}\` for prod). Grab the real values from the Convex dashboard; reference them as \`<your dev convex site url>\` and \`<your prod convex site url>\` in the steps below.`,
  },
  {
    slug: "discord-app",
    category: "Setup",
    label: "Discord application",
    title: "Set up the Discord application",
    summary: "Two apps. One for dev, one for prod.",
    markdown: `## Set up the Discord application

Keep two Discord applications, one for dev and one for prod. Mixing them is the single most common cause of lost tokens and failed signature checks.

1. Go to https://discord.com/developers/applications and click **New Application**. Name it "Forge (dev)".
2. On **General Information** copy:
   - **Application ID** into Convex env as \`DISCORD_APPLICATION_ID\`
   - **Public Key** into Convex env as \`DISCORD_PUBLIC_KEY\`
3. On **OAuth2** copy **Client Secret** into Convex env as \`DISCORD_CLIENT_SECRET\`.
4. Open **Bot**, click **Add Bot**, then **Reset Token**. Copy into \`DISCORD_BOT_TOKEN\`. Discord only shows it once.
5. Leave every **Privileged Gateway Intent** off.

**Set the interactions endpoint**

Paste \`<your convex site url>/interactions\` into **Interactions Endpoint URL** on **General Information** and click Save. Example:

\`\`\`
${DEV_SITE_URL}/interactions
\`\`\`

Discord sends a verification PING and only accepts the URL if the Ed25519 check passes.

**Set the OAuth2 redirect URI**

On **OAuth2 > General**, add redirect \`<your convex site url>/api/discord/install\`.

**Set Convex env**

\`\`\`bash
npx convex env set DISCORD_APPLICATION_ID <value>
npx convex env set DISCORD_PUBLIC_KEY <value>
npx convex env set DISCORD_BOT_TOKEN <value>
npx convex env set DISCORD_CLIENT_SECRET <value>
\`\`\`

For production repeat with \`--prod\` on a separate Discord app.`,
  },
  {
    slug: "permissions",
    category: "Setup",
    label: "Bot permissions",
    title: "Bot permissions and scopes",
    summary: "Seven permissions. Two OAuth scopes. Zero intents.",
    markdown: `## Bot permissions and scopes

Forge ships with this default bitmask in \`convex/discord.ts\`:

\`\`\`
DEFAULT_PERMISSIONS = "328565051456"
\`\`\`

That value is the sum of these seven permission bits:

| Bit | Value | Permission | Why |
|---|---|---|---|
| 10 | 1,024 | View Channels | List channels, roles, forum tags |
| 11 | 2,048 | Send Messages | Post to mod queue and text destinations |
| 13 | 8,192 | Manage Messages | Edit mod queue message after Approve or Deny |
| 14 | 16,384 | Embed Links | Render submission embeds |
| 34 | 17,179,869,184 | Manage Threads | Apply forum tags, edit threads |
| 35 | 34,359,738,368 | Create Public Threads | Publish to Forum channels |
| 38 | 274,877,906,944 | Send Messages in Threads | Post inside forum threads |

OAuth scopes, separate from permissions: \`bot\` and \`applications.commands\`.

Voice permissions: none. Forge never touches voice.

Message Content Intent: off. Forge never reads free form messages.

If a server admin insists on the Use Slash Commands bit, set \`DISCORD_BOT_PERMISSIONS=330712535104\` which adds bit 31. The \`applications.commands\` scope usually makes that redundant.`,
  },
  {
    slug: "invite",
    category: "Setup",
    label: "Invite the bot",
    title: "Invite the bot into a server",
    summary: "Forge mints a signed invite for you.",
    markdown: `## Invite the bot into a server

You never paste an invite URL by hand.

1. Start the frontend: \`npm run dev\`.
2. Sign in at \`/\` (the homepage is the sign-in screen).
3. Open \`/app/settings\` and click **Connect server**.
4. The action \`api.discord.generateInstallUrl\` mints a CSRF nonce, stores it in \`oauthStates\` with a 10 minute TTL, and redirects you to Discord with the bitmask, scopes, and \`state=<nonce>\` baked in.
5. Pick the server, confirm permissions, click Authorize.
6. Discord redirects to \`<convex site>/api/discord/install?code=...&state=...&guild_id=...\`.
7. The HTTP callback verifies the nonce, exchanges the code, writes a \`guilds\` row, and redirects to \`/app/settings?installed=<guildId>\` on success or \`/app/settings?error=<code>\` on failure.

\`/app\` shows a connected guild banner once the row lands.`,
  },
  {
    slug: "auth",
    category: "Auth",
    label: "Auth (Robel + GitHub)",
    title: "Set up auth (Robel Convex Auth + GitHub)",
    summary: "GitHub OAuth via @robelest/convex-auth. Lives inside Convex.",
    markdown: `## Set up auth (Robel Convex Auth + GitHub)

Forge signs admins in with [\`@robelest/convex-auth\`](https://github.com/robelest/convex-auth/) using GitHub as the only provider. The auth component lives inside the Convex deployment. No separate identity vendor.

**How the flow works**

1. An admin opens Forge at \`/\`. The homepage renders the sign-in screen.
2. Clicking **Continue with GitHub** calls the Robel browser client, which redirects to GitHub with state and PKCE.
3. GitHub redirects back to \`<your convex site url>/.auth/callback/github\`. Robel exchanges the code, reads profile and primary email from GitHub, and writes a session into the component's tables.
4. The component mints a JWT with \`iss = CONVEX_SITE_URL\` and \`aud = "convex"\`. The browser stores it in \`localStorage\`.
5. Every Convex query and mutation runs \`requireAllowedViewer(ctx)\` from \`convex/lib/auth.ts\`. It reads email via \`auth.user.viewer(ctx)\` (not \`ctx.auth.getUserIdentity()\`, which does not carry email on Robel) and checks against the allowlist.
6. Allowed emails get a \`users\` row stamped \`role: owner | admin\`. Denied emails land on \`/auth/denied\` and \`useAutoSignOut\` invalidates the session to stop refresh loops.
7. Signing out clears the JWT, refresh token, and OAuth verifier, calls \`signOut\` once, and Protected redirects back to \`/\`.

**Files that matter for auth**

| File | Role |
|---|---|
| \`convex/auth.ts\` | Configures \`createAuth\` with \`github({ clientId, clientSecret })\` |
| \`convex/auth.config.ts\` | Trusts JWTs with \`iss = CONVEX_SITE_URL\`, \`aud = "convex"\` |
| \`convex/convex.config.ts\` | Registers \`@robelest/convex-auth\` |
| \`convex/http.ts\` | \`auth.http.add(http)\` mounts callbacks + JWKS |
| \`convex/lib/auth.ts\` | \`requireAllowedViewer\` used everywhere |
| \`convex/users.ts\` | Reads identity via \`auth.user.viewer(ctx)\` |
| \`src/lib/auth.ts\` | Browser client + deterministic \`signOutNow\` |
| \`src/hooks/useAuth.ts\` | \`useSyncExternalStore\` over \`auth.onChange\` |
| \`src/components/auth/SignIn.tsx\` | Homepage sign-in button |
| \`src/components/auth/Protected.tsx\` | Route gate, redirects to \`/\` when signed out |
| \`patches/@robelest+convex-auth+0.0.4-preview.27.patch\` | Fixes GitHub \`expires_in\` bug |

**GitHub OAuth App**

Create one per deployment at https://github.com/settings/developers.

1. Click **New OAuth App**. Name it "Forge (dev)".
2. Homepage URL: \`http://localhost:5173\` for dev, \`${PROD_SITE_URL}\` for prod.
3. Authorization callback URL: \`<your convex site url>/.auth/callback/github\`.
   - Dev: \`${DEV_SITE_URL}/.auth/callback/github\`
   - Prod: \`${PROD_SITE_URL}/.auth/callback/github\`
4. Register, copy **Client ID**, generate and copy the **Client Secret**.

**Generate Robel keys**

\`\`\`bash
npx @robelest/convex-auth
\`\`\`

If the CLI exits quietly, set them by hand from its output:

\`\`\`bash
npx convex env set JWT_PRIVATE_KEY '<generated private key>'
npx convex env set JWKS '<generated jwks json>'
\`\`\`

**Set the rest of auth env on Convex**

\`\`\`bash
npx convex env set AUTH_GITHUB_ID <github oauth client id>
npx convex env set AUTH_GITHUB_SECRET <github oauth client secret>
npx convex env set SITE_URL http://localhost:5173
npx convex env set OWNER_EMAIL you@yourdomain.com
\`\`\`

For prod, repeat with \`--prod\` and a separate GitHub OAuth App:

\`\`\`bash
npx convex env set AUTH_GITHUB_ID <prod client id> --prod
npx convex env set AUTH_GITHUB_SECRET <prod client secret> --prod
npx convex env set SITE_URL ${PROD_SITE_URL} --prod
npx convex env set OWNER_EMAIL you@yourdomain.com --prod
npx @robelest/convex-auth --prod
\`\`\`

\`OWNER_EMAIL\` is optional. Unset falls back to the upstream owner (\`wayne@convex.dev\`); set it per deployment so the owner follows your team.

**Gotchas**

- \`ctx.auth.getUserIdentity().email\` is always \`undefined\` on Robel. Use \`auth.user.viewer(ctx)\` instead.
- Denied sessions must call \`auth.signOut()\` or Convex will loop refresh every 500 ms. \`useAutoSignOut\` handles this for \`/auth/denied\`.
- \`CONVEX_SITE_URL\` is auto-populated. You do not set it.`,
  },
  {
    slug: "admins",
    category: "Auth",
    label: "Admins",
    title: "Admin access and how to add admins",
    summary: "One file. One domain rule. One owner email.",
    markdown: `## Admin access and how to add admins

Access is gated by email allowlist. Two roles exist:

- \`owner\`: one deterministic email pinned in code
- \`admin\`: any other allowlisted email

Everyone else lands on \`/auth/denied\` with a one-shot sign out so the session does not refresh loop.

**The allowlist lives in a single file**

\`\`\`
convex/lib/access.ts
\`\`\`

That file exports \`isAllowedEmail(email)\` and \`roleForEmail(email)\`. They read a domain match (\`@convex.dev\` in the current build) and an owner email pulled from the \`OWNER_EMAIL\` Convex env var, falling back to \`wayne@convex.dev\` when unset. Rewrite the file to change the domain rule. Set the env var to change the owner without touching code.

**To add an admin for your own install**

1. Open \`convex/lib/access.ts\`.
2. Change \`ALLOWED_EMAIL_SUFFIX\` to your company domain, or swap the check for an explicit \`Set<string>\` of addresses.
3. Set the owner via env on each deployment:

\`\`\`bash
npx convex env set OWNER_EMAIL you@yourdomain.com
npx convex env set OWNER_EMAIL you@yourdomain.com --prod
\`\`\`

4. Save. \`npx convex dev\` hot reloads the backend.
5. Have the new admin sign in with a matching email. \`users.upsertFromIdentity\` creates a \`users\` row stamped with the right role.

**Tenancy model**

Forge is a shared workspace. Every allowlisted user can read and edit every installed guild, form, and submission. The email allowlist IS the tenancy boundary. If you ever widen the allowlist beyond a trusted team, add a \`memberships\` table keyed on \`{ userId, guildId, role }\` and a \`requireGuildAccess(ctx, guildId)\` helper before shipping. See \`prds/security-audit-fixes-2026-04-18.md\`.

**Files that depend on the rule**

- \`convex/users.ts\` reads the role during \`access\`, \`me\`, and \`upsertFromIdentity\`
- \`convex/lib/auth.ts\` enforces it on every query and mutation via \`requireAllowedViewer\`
- \`src/components/auth/Protected.tsx\` routes denied sessions to \`/auth/denied\`
- \`src/hooks/useAutoSignOut.ts\` signs denied sessions out once to avoid a refresh loop
- \`src/pages/AccessDenied.tsx\` renders the denied state
- \`prds/access-control.md\` documents the current rule`,
  },
  {
    slug: "env",
    category: "Reference",
    label: "Environment variables",
    title: "Environment variables",
    summary: "Client side vs server side at a glance.",
    markdown: `## Environment variables

**Frontend \`.env.local\`**

| Key | Used by | Notes |
|---|---|---|
| \`VITE_CONVEX_URL\` | \`src/lib/convex.ts\` | \`*.convex.cloud\` URL from \`npx convex dev\` |
| \`VITE_CONVEX_SITE_URL\` | Sign-in helpers | \`*.convex.site\` URL. Optional |

**Convex deployment env** (\`npx convex env set\`)

| Key | Required | Notes |
|---|---|---|
| \`DISCORD_APPLICATION_ID\` | yes | Discord app id |
| \`DISCORD_PUBLIC_KEY\` | yes | Verifies \`/interactions\` signatures |
| \`DISCORD_BOT_TOKEN\` | yes | Bot token, never expose to the client |
| \`DISCORD_CLIENT_SECRET\` | yes | OAuth2 client secret for bot install |
| \`DISCORD_BOT_PERMISSIONS\` | no | Defaults to \`328565051456\` |
| \`AUTH_GITHUB_ID\` | yes | GitHub OAuth App client id |
| \`AUTH_GITHUB_SECRET\` | yes | GitHub OAuth App client secret |
| \`JWT_PRIVATE_KEY\` | yes | Set by \`npx @robelest/convex-auth\` |
| \`JWKS\` | yes | Set by \`npx @robelest/convex-auth\` |
| \`SITE_URL\` | yes | Frontend base URL. Also pins \`Access-Control-Allow-Origin\` on Discord preflights |
| \`OWNER_EMAIL\` | no | Email mapped to \`role: "owner"\`. Defaults to the upstream owner when unset |
| \`CONVEX_SITE_URL\` | auto | Auto-populated by Convex |

Set the same keys on prod with \`--prod\`.`,
  },
  {
    slug: "localhost-to-production",
    category: "Deploy",
    label: "Localhost to production",
    title: "Go from localhost to production",
    summary:
      "End-to-end checklist for promoting Forge from your laptop to the prod Convex site URL.",
    markdown: `## Go from localhost to production

Use this checklist the first time you promote Forge from local dev to the production Convex deploy. Skip the steps you have already done.

### 1. Prove it works on dev first

- \`npx convex dev\` is running and points at the dev deployment (\`${DEV_SITE_URL}\`)
- You can sign in at \`http://localhost:5173/\` with a GitHub account whose primary email matches \`convex/lib/access.ts\`
- You can connect a test Discord server, publish a form, and submit it from Discord
- The audit log records the submission and the forum or text post lands in Discord

If any step fails on dev, do not ship. Production will inherit the same bug.

### 2. Create a separate Convex project for prod

Production should never share a deployment with dev. A dropped message on dev should not take down the prod bot.

\`\`\`bash
npx convex login
npx convex init --prod
\`\`\`

This writes the prod deploy key into \`.env.local\` under \`CONVEX_DEPLOY_KEY\`. The prod deployment gets its own auto-generated \`CONVEX_SITE_URL\` (shape: \`${PROD_SITE_URL}\`). Reference this URL as \`<your prod convex site url>\` in every step below.

### 3. Create a second Discord application for prod

Dev and prod must have distinct Discord applications. Dev tokens and public keys cannot sign prod interactions.

- Open https://discord.com/developers/applications
- Click **New Application** and name it something like \`Forge Prod\`
- Copy \`APPLICATION ID\`, \`PUBLIC KEY\`, and reset and copy the bot token
- Set **Interactions Endpoint URL** to \`${PROD_SITE_URL}/interactions\`
- Add the OAuth redirect \`${PROD_SITE_URL}/oauth/callback\`
- Generate the install URL with the seven-permission bitmask and \`scope=bot applications.commands\`

### 4. Create a second GitHub OAuth App for prod

Dev and prod need distinct GitHub OAuth Apps so the callback URL per env stays correct.

- Open https://github.com/settings/developers and click **New OAuth App**
- **Homepage URL**: \`${PROD_SITE_URL}\`
- **Authorization callback URL**: \`${PROD_SITE_URL}/.auth/callback/github\`
- Generate a client secret and copy both the client ID and secret

### 5. Set prod env vars on the prod deployment

Every env var uses the same \`npx convex env set --prod\` pattern. The \`--prod\` flag targets the production deployment instead of dev.

\`\`\`bash
npx convex env set --prod DISCORD_APPLICATION_ID <prod app id>
npx convex env set --prod DISCORD_PUBLIC_KEY <prod public key>
npx convex env set --prod DISCORD_BOT_TOKEN <prod bot token>
npx convex env set --prod DISCORD_CLIENT_ID <prod client id>
npx convex env set --prod DISCORD_CLIENT_SECRET <prod client secret>
npx convex env set --prod AUTH_GITHUB_ID <prod github client id>
npx convex env set --prod AUTH_GITHUB_SECRET <prod github client secret>
npx convex env set --prod JWT_PRIVATE_KEY "$(cat jwt-private-key.pem)"
npx convex env set --prod JWKS "$(cat jwks.json)"
npx convex env set --prod SITE_URL ${PROD_SITE_URL}
npx convex env set --prod OWNER_EMAIL you@yourdomain.com
\`\`\`

Reuse the same \`JWT_PRIVATE_KEY\` and \`JWKS\` on dev and prod only if you want logged-in dev sessions to carry over. For a clean split, generate a fresh pair with \`npx @robelest/convex-auth\` and set those on prod only.

### 6. Build against the prod Convex URL

\`VITE_CONVEX_URL\` is read at build time. The \`deploy\` script in \`package.json\` reads the prod URL automatically when you run:

\`\`\`bash
npm run deploy
\`\`\`

This runs \`npx @convex-dev/static-hosting deploy\` which:

1. Runs \`npx convex deploy\` against the prod deployment.
2. Builds the Vite frontend with the prod \`VITE_CONVEX_URL\`.
3. Uploads \`dist/\` to Convex storage and garbage-collects older bundles.

### 7. Smoke test the prod deployment

- Open \`${PROD_SITE_URL}/\` in an incognito window
- Sign in with a GitHub account whose primary email matches the allowlist
- Go to Settings, click **Connect Discord server**, complete the OAuth install
- Publish a form and submit from the Discord server
- Confirm the audit log entry and the forum or text post

If the Discord slash command does not appear, open the form editor and click **Update Discord command**. Discord propagates command changes in seconds for a registered application, but the first publish per command can take a few minutes.

### 8. Roll over secrets if you ever need to

- Rotate the Discord bot token in the Discord developer portal, then \`npx convex env set --prod DISCORD_BOT_TOKEN ...\`
- Rotate the GitHub OAuth secret in GitHub, then \`npx convex env set --prod AUTH_GITHUB_SECRET ...\`
- To regenerate the JWT keypair run \`npx @robelest/convex-auth\` again and set \`JWT_PRIVATE_KEY\` and \`JWKS\`. Every signed-in admin must sign in again after this.

Never commit any of these values. \`.env.local\` is git-ignored for a reason.`,
  },
  {
    slug: "deploy",
    category: "Deploy",
    label: "Static hosting",
    title: "Deploy to production on Convex static hosting",
    summary: "One command ships backend and frontend together.",
    markdown: `## Deploy to production on Convex static hosting

Forge ships the React bundle through \`@convex-dev/static-hosting\`. Backend and frontend live on the same Convex site URL, no separate Vercel or Netlify required. See https://www.convex.dev/components/static-hosting for the component overview.

**Reference your own Convex site URLs**

- Dev deploy: \`<your dev convex site url>\` (shape: \`${DEV_SITE_URL}\`)
- Prod deploy: \`<your prod convex site url>\` (shape: \`${PROD_SITE_URL}\`)

Convex assigns a unique \`<animal-name-1234>.convex.site\` domain per deployment. Grab the exact values from the Convex dashboard (Settings → URL) and substitute them everywhere below.

**Confirm the component is registered**

\`convex/convex.config.ts\` should contain:

\`\`\`ts
import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";

const app = defineApp();
app.use(staticHosting);
export default app;
\`\`\`

\`convex/http.ts\` should call \`registerStaticRoutes(http, components.selfHosting)\`. \`convex/staticHosting.ts\` should expose the upload API via \`exposeUploadApi(...)\` and \`getCurrentDeployment\` via \`exposeDeploymentQuery(...)\`.

**Deploy**

\`\`\`bash
npx convex login
npm run deploy
\`\`\`

\`npm run deploy\` runs \`npx @convex-dev/static-hosting deploy\` which:

1. Builds the frontend with the production \`VITE_CONVEX_URL\`.
2. Runs \`npx convex deploy\` to push schema, functions, and HTTP routes.
3. Uploads the built \`dist/\` files to Convex storage, garbage collecting older deployment files.

After the first successful run, your prod Convex site URL serves the app. Sign in, connect a prod Discord server against the prod Discord application.

**Live reload**

Wire \`<UpdateBanner>\` from \`@convex-dev/static-hosting/react\` against the \`getCurrentDeployment\` query to show a refresh prompt when a newer deployment lands.`,
  },
  {
    slug: "troubleshooting",
    category: "Reference",
    label: "Troubleshooting",
    title: "Troubleshooting",
    summary: "Common errors and what to try first.",
    markdown: `## Troubleshooting

**Interactions Endpoint URL could not be validated**
- \`DISCORD_PUBLIC_KEY\` missing or mismatched
- URL points at \`.convex.cloud\` instead of \`.convex.site\`
- Dev deploy paused; run \`npx convex dev\`

**Callback lands on \`/app/settings?error=invalid_state\`**
- CSRF nonce expired (10 minute TTL) or was already consumed

**Callback lands on \`/app/settings?error=discord_missing_guild\`**
- OAuth request dropped the \`bot\` scope. Make sure \`generateInstallUrl\` sends \`scope=bot applications.commands\`

**Callback lands on \`/app/settings?error=server_not_configured\`**
- One of \`DISCORD_BOT_TOKEN\`, \`DISCORD_PUBLIC_KEY\`, \`DISCORD_APPLICATION_ID\` is missing in Convex env

**Allowlisted email still lands on \`/auth/denied\`**
- GitHub primary email does not match the domain in \`convex/lib/access.ts\`. Set a matching primary email in GitHub and try again
- \`AUTH_GITHUB_ID\` or \`AUTH_GITHUB_SECRET\` was rotated without updating Convex env
- \`JWT_PRIVATE_KEY\` or \`JWKS\` were regenerated mid-session. Sign out and back in

**Sign-in button spins then fails with \`OAUTH_PROVIDER_ERROR\`**
- GitHub OAuth App callback URL does not end in \`/.auth/callback/github\`. Update it in GitHub
- The Robel patch was not applied. Run \`npm install\` to let \`patch-package\` reapply it

**Convex logs show repeating \`auth:signIn\` + \`auth:store refreshSession\`**
- A denied session is not signing itself out. Confirm \`useAutoSignOut\` is still wired into \`src/pages/AccessDenied.tsx\`

**Bot is in the server but the slash command does not appear**
- Form is in draft. Open the editor and click Update Discord command
- Bot lacks \`applications.commands\` scope. Reinstall from \`/app/settings\`

**Discord REST error codes in the audit log**
- \`10003\` unknown channel: destination was deleted or moved. Pick a new one
- \`50001\` missing access: add the bot to the target channel
- \`50013\` missing permissions: grant the missing permission
- \`50035\` invalid form body: title template or embed exceeds Discord limits
- \`160002\` max active threads: archive old forum threads or lower the daily cap`,
  },
  {
    slug: "references",
    category: "Reference",
    label: "Links",
    title: "References",
    summary: "Upstream docs and repo files worth bookmarking.",
    markdown: `## References

- Forge source code: https://github.com/waynesutton/forge-for-discord
- Discord developer portal: https://discord.com/developers/applications
- Discord bots overview: https://docs.discord.com/developers/bots/overview
- Discord developer reference: https://docs.discord.com/developers/reference
- Discord API docs repo: https://github.com/discord/discord-api-docs
- Discord bots guide: https://docs.discord.com/developers/guides/bots
- Discord permission bitmask: https://discord.com/developers/docs/topics/permissions
- Convex static hosting component: https://www.convex.dev/components/static-hosting/static-hosting.md
- Convex HTTP actions: https://docs.convex.dev/functions/http-actions
- Convex dev workflow: https://docs.convex.dev/understanding/workflow
- Robel Convex Auth repo: https://github.com/robelest/convex-auth/
- Robel Convex Auth docs: https://auth.estifanos.com/getting-started/installation/
- GitHub OAuth Apps: https://github.com/settings/developers
- Robel integration notes: \`prds/robel-auth-integration-report.md\`
- Forge PRD: \`prds/forge-prd_1.md\`
- Access control PRD: \`prds/access-control.md\`
- Discord app walkthrough: \`docs/discord-setup.md\`
- Setup guide (canonical): \`docs/setup-guide.md\``,
  },
];

const CATEGORY_ORDER: Array<string> = [
  "Start here",
  "Setup",
  "Auth",
  "Deploy",
  "Reference",
];

export function Docs() {
  // `Docs` is reachable from two places: the public `/docs` route (no outlet
  // context) and, historically, from Protected children. `useOutletContext`
  // returns `undefined` on the public surface, which we treat as "show the
  // logged-out header". `useAuth` gives us the auth snapshot so the signed-in
  // variant can still add the dashboard link even if someone hits `/docs`
  // directly with a valid session.
  const outlet = useOutletContext<ProtectedContext | undefined>();
  const { isAuthenticated } = useAuth();
  const me = outlet?.me;
  const showAppLinks = Boolean(me) || isAuthenticated;
  const params = useParams<{ slug?: string }>();
  const navigate = useNavigate();

  const active = useMemo(() => {
    const found = SECTIONS.find((s) => s.slug === params.slug);
    return found ?? SECTIONS[0];
  }, [params.slug]);

  const grouped = useMemo(() => {
    const map = new Map<string, Array<Section>>();
    for (const section of SECTIONS) {
      const list = map.get(section.category) ?? [];
      list.push(section);
      map.set(section.category, list);
    }
    return CATEGORY_ORDER.map((category) => ({
      category,
      sections: map.get(category) ?? [],
    }));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to={showAppLinks ? "/app" : "/"}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-window)] transition-colors hover:border-[var(--color-ink)]"
            aria-label={showAppLinks ? "Back to dashboard" : "Back to homepage"}
          >
            <ArrowLeft size={16} weight="bold" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Docs</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
              {me ? `${me.role} workspace` : "Setup guide"}
            </p>
          </div>
        </div>

        {showAppLinks ? (
          <Link
            to="/app/settings"
            className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
          >
            <Gear size={16} weight="bold" aria-hidden />
            <span>Settings</span>
          </Link>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-2 text-sm font-medium text-[var(--color-surface)] shadow-[var(--shadow-window)] transition-transform duration-150 active:translate-y-px"
          >
            <GithubLogo size={16} weight="bold" aria-hidden />
            <span>Sign in</span>
          </Link>
        )}
      </header>

      {showAppLinks ? (
        <WindowTabs
          tabs={[
            { to: "/app/forms", label: "Forms" },
            { to: "/docs", label: "Docs", active: true },
            { to: "/app/settings", label: "Settings" },
          ]}
        />
      ) : null}

      <section className="overflow-hidden rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-window)]">
        <header className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#f3665c]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#f6c75a]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#58c88f]" aria-hidden />
          <span className="ml-3 text-xs font-medium tracking-wide text-[var(--color-muted)]">
            forge / docs / {active.slug}
          </span>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
          <aside className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-6 md:border-b-0 md:border-r">
            <div className="sticky top-6 flex flex-col gap-6">
              <div className="flex items-center gap-2 px-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <Lightning
                    size={16}
                    weight="fill"
                    color="var(--color-accent)"
                  />
                </span>
                <span className="text-sm font-semibold">Forge docs</span>
              </div>

              <nav
                aria-label="Docs sections"
                className="flex flex-col gap-5"
              >
                {grouped.map((group) => (
                  <div key={group.category} className="flex flex-col gap-1">
                    <p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                      {group.category}
                    </p>
                    <ul className="flex flex-col">
                      {group.sections.map((section) => {
                        const isActive = section.slug === active.slug;
                        return (
                          <li key={section.slug}>
                            <Link
                              to={`/docs/${section.slug}`}
                              aria-current={isActive ? "page" : undefined}
                              className={
                                isActive
                                  ? "flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-2 py-1.5 text-sm font-medium text-[var(--color-surface)]"
                                  : "flex items-center gap-2 rounded-[var(--radius-window)] border border-transparent px-2 py-1.5 text-sm text-[var(--color-muted)] transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                              }
                            >
                              <FileText
                                size={14}
                                weight={isActive ? "fill" : "regular"}
                                aria-hidden
                              />
                              <span>{section.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}

                <div className="px-2 pt-2 text-xs text-[var(--color-muted)]">
                  Canonical markdown lives at{" "}
                  <code className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-[11px]">
                    docs/setup-guide.md
                  </code>
                  .
                </div>
              </nav>
            </div>
          </aside>

          <article className="flex flex-col gap-6 px-6 py-8 md:px-10 md:py-10">
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                {active.category}
              </span>
              <h2 className="text-2xl font-semibold tracking-tight">
                {active.title}
              </h2>
              <p className="max-w-2xl text-sm text-[var(--color-muted)]">
                {active.summary}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <CopyMarkdownButton
                  label="Copy markdown"
                  text={active.markdown}
                />
                <CopyMarkdownButton
                  label="Copy link"
                  text={`${typeof window !== "undefined" ? window.location.origin : ""}/docs/${active.slug}`}
                  icon={<LinkIcon size={14} weight="bold" aria-hidden />}
                />
              </div>
            </div>

            <div className="prose-forge flex flex-col gap-5 text-[15px] leading-relaxed text-[var(--color-ink)]">
              {renderMarkdown(active.markdown, { skipFirstH2: true })}
            </div>

            <nav
              aria-label="Next steps"
              className="flex flex-wrap gap-3 border-t border-[var(--color-border)] pt-6 text-sm"
            >
              <PrevNextLink active={active} direction="prev" onGo={navigate} />
              <PrevNextLink active={active} direction="next" onGo={navigate} />
            </nav>
          </article>
        </div>
      </section>
    </main>
  );
}

function PrevNextLink({
  active,
  direction,
  onGo,
}: {
  active: Section;
  direction: "prev" | "next";
  onGo: (to: string) => void;
}) {
  const index = SECTIONS.findIndex((s) => s.slug === active.slug);
  const target =
    direction === "prev" ? SECTIONS[index - 1] : SECTIONS[index + 1];
  if (!target) return null;
  return (
    <button
      type="button"
      onClick={() => onGo(`/docs/${target.slug}`)}
      className="flex flex-col items-start gap-0.5 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--color-ink)]"
    >
      <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
        {direction === "prev" ? "Previous" : "Next"}
      </span>
      <span className="text-sm font-medium text-[var(--color-ink)]">
        {target.title}
      </span>
    </button>
  );
}

function CopyMarkdownButton({
  label,
  text,
  icon,
}: {
  label: string;
  text: string;
  icon?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
    >
      {copied ? (
        <CheckCircle size={14} weight="fill" color="var(--color-success)" />
      ) : (
        (icon ?? <Copy size={14} weight="bold" aria-hidden />)
      )}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

// Minimal markdown renderer. Handles the subset used by the Forge docs:
// ## headings, paragraphs, unordered lists, fenced code blocks, pipe tables,
// inline code, bold, and http(s) links. Keeps the renderer predictable so we
// don't pull in a markdown dependency for a handful of docs pages.
function renderMarkdown(
  source: string,
  opts: { skipFirstH2?: boolean } = {},
): ReactNode {
  const blocks = splitBlocks(source);
  const nodes: Array<ReactNode> = [];
  let sawH2 = false;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.trim() === "") continue;

    if (block.startsWith("```")) {
      nodes.push(<CodeBlock key={i} block={block} />);
      continue;
    }

    if (block.startsWith("## ")) {
      if (opts.skipFirstH2 && !sawH2) {
        sawH2 = true;
        continue;
      }
      sawH2 = true;
      nodes.push(
        <h3
          key={i}
          className="mt-2 text-lg font-semibold tracking-tight text-[var(--color-ink)]"
        >
          {block.replace(/^##\s+/, "")}
        </h3>,
      );
      continue;
    }

    if (/^\s*\|/.test(block)) {
      nodes.push(<MarkdownTable key={i} block={block} />);
      continue;
    }

    if (/^\s*-\s+/m.test(block) && block.split("\n").every((line) => /^\s*-\s+/.test(line) || line.trim() === "")) {
      const items = block
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map((l) => l.replace(/^\s*-\s+/, ""));
      nodes.push(
        <ul
          key={i}
          className="flex list-disc flex-col gap-1.5 pl-5 text-[var(--color-ink)] marker:text-[var(--color-muted)]"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    nodes.push(
      <p key={i} className="text-[var(--color-ink)]">
        {renderInline(block)}
      </p>,
    );
  }

  return <>{nodes}</>;
}

function splitBlocks(source: string): Array<string> {
  const blocks: Array<string> = [];
  const lines = source.split("\n");
  let buffer: Array<string> = [];
  let inCode = false;

  const flush = () => {
    if (buffer.length === 0) return;
    blocks.push(buffer.join("\n"));
    buffer = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (!inCode) {
        flush();
        buffer.push(line);
        inCode = true;
      } else {
        buffer.push(line);
        flush();
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      buffer.push(line);
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return blocks;
}

function CodeBlock({ block }: { block: string }) {
  const lines = block.split("\n");
  const fence = lines[0] ?? "";
  const lang = fence.replace(/^```/, "").trim();
  const body = lines.slice(1, lines.length - 1).join("\n");
  return (
    <div className="overflow-hidden rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-ink)] text-[var(--color-surface)] shadow-[var(--shadow-window)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">
          {lang || "code"}
        </span>
        <CopyInline text={body} />
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-[1.6]">
        <code className="font-mono">{body}</code>
      </pre>
    </div>
  );
}

function CopyInline({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/80 transition-colors hover:border-white/40 hover:text-white"
    >
      {copied ? (
        <CheckCircle size={12} weight="fill" />
      ) : (
        <Copy size={12} weight="bold" aria-hidden />
      )}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function MarkdownTable({ block }: { block: string }) {
  const rows = block
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );
  if (rows.length < 2) return null;
  const header = rows[0];
  const divider = rows[1];
  const body = rows.slice(2);
  const isDivider = divider.every((c) => /^:?-+:?$/.test(c));
  const dataRows = isDivider ? body : rows.slice(1);
  return (
    <div className="overflow-hidden rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
            <tr>
              {header.map((cell, idx) => (
                <th
                  key={idx}
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em]"
                >
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {dataRows.map((row, r) => (
              <tr key={r} className="align-top">
                {row.map((cell, c) => (
                  <td key={c} className="px-3 py-2 text-[var(--color-ink)]">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderInline(text: string): ReactNode {
  // Order matters: escape fenced code first, then bold, then links, then inline code.
  const tokens: Array<ReactNode> = [];
  let remainder = text;
  let key = 0;

  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(https?:\/\/[^\s)]+)/;

  while (remainder.length > 0) {
    const match = pattern.exec(remainder);
    if (!match) {
      tokens.push(<span key={key++}>{remainder}</span>);
      break;
    }
    const idx = match.index;
    if (idx > 0) {
      tokens.push(<span key={key++}>{remainder.slice(0, idx)}</span>);
    }
    const found = match[0];
    if (found.startsWith("`")) {
      tokens.push(
        <code
          key={key++}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--color-ink)]"
        >
          {found.slice(1, -1)}
        </code>,
      );
    } else if (found.startsWith("**")) {
      tokens.push(
        <strong key={key++} className="font-semibold text-[var(--color-ink)]">
          {found.slice(2, -2)}
        </strong>,
      );
    } else if (found.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(found);
      if (linkMatch) {
        tokens.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            {linkMatch[1]}
          </a>,
        );
      }
    } else {
      tokens.push(
        <a
          key={key++}
          href={found}
          target="_blank"
          rel="noreferrer"
          className="break-all text-[var(--color-accent)] underline-offset-4 hover:underline"
        >
          {found}
        </a>,
      );
    }
    remainder = remainder.slice(idx + found.length);
  }

  return <>{tokens}</>;
}
