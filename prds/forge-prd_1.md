# Forge — Tech PRD

A self-hostable Discord form builder and approval engine. Create forms in a PostHog-style dashboard, submit via Discord slash commands, route through mod approval, publish to any channel including Forum channels with tags.

**Stack:** React 19 + Vite + Convex + Robelest Convex Auth (GitHub OAuth) + Discord HTTP Interactions
**Hosting:** `@convex-dev/static-hosting` (frontend) + Convex HTTP actions (backend + Discord bot)
**Icons:** Phosphor Icons via `@phosphor-icons/react`

---

## 1. Goals and non-goals

### Goals

- A dashboard for creating and editing forms visually, similar to how PostHog organizes features.
- Forms map to Discord slash commands. One form equals one command.
- Submissions can route to any channel: text or Forum, public or private.
- Optional approval gate: submissions land in a mod queue, mods click Approve or Deny.
- Approved submissions auto-publish to a target channel (text or Forum with tag).
- For Forum posts, admin picks which form question becomes the thread title, or sets a static title template.
- Submitter gets a DM on approve or deny.
- Audit log of every submission and decision.

### Non-goals (v1)

- Listening to regular (non-command) Discord messages.
- Voice or role-based gated servers.
- Multi-workspace SaaS. Single self-hosted instance per admin.
- Mobile app. Dashboard is web only.
- Non-Discord destinations (Slack, email). Add later.

---

## 2. Users and personas

- **Server admin (you).** Creates forms, sets up approval rules, reviews audit log. Authenticates via GitHub.
- **Mod.** Approves/denies submissions inside Discord. No dashboard access needed.
- **Server member.** Runs slash commands in Discord, fills modals, gets DM confirmations.

---

## 3. High-level architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Discord (user-facing)                  │
│  Slash command  →  Modal  →  Button clicks  →  DMs       │
└────────────────┬───────────────────────────▲─────────────┘
                 │ HTTP POST                 │ REST API
                 ▼                           │
┌──────────────────────────────────────────────────────────┐
│                    Convex Deployment                     │
│  ┌────────────────────┐    ┌──────────────────────────┐  │
│  │  HTTP actions      │    │  Mutations / Queries     │  │
│  │  /interactions     │◄──►│  forms, submissions,     │  │
│  │  auth.http.add     │    │  decisions, audit_log    │  │
│  │  (Discord + Robel) │    └──────────────────────────┘  │
│  └─────────▲──────────┘                                  │
└────────────┼─────────────────────────────────────────────┘
             │ reactive sync
             ▼
┌──────────────────────────────────────────────────────────┐
│    React dashboard (Vite, @convex-dev/static-hosting)    │
│   Form builder  •  Submission inbox  •  Audit log        │
│   Auth gate via Robelest Convex Auth (GitHub OAuth)      │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | React 19 + Vite | Fast, native TS, matches your stack |
| Styling | Tailwind v4 + custom design tokens | Enables PostHog-style aesthetic |
| UI primitives | Radix UI + shadcn/ui | Accessible, themeable |
| Form builder drag-drop | dnd-kit | Modern, accessible, React-first |
| Backend | Convex | Realtime, serverless, one deploy |
| Discord integration | HTTP actions + REST fetch | No gateway, no always-on |
| Signature verification | `discord-interactions` npm package | Official Discord helper |
| Auth | `@robelest/convex-auth` + GitHub via `OAuth()` factory | First-class Convex component, owns its own tables, CLI wizard (https://auth.estifanos.com/getting-started/installation/) |
| Icons | `@phosphor-icons/react` | Flexible weight variants, clean geometry (https://phosphoricons.com/) |
| Hosting (frontend) | `@convex-dev/static-hosting` | Serve dist from Convex storage, one deploy target |
| Hosting (backend) | Convex deployment | Same runtime as static hosting |
| Domain | Custom domain via Convex | Supported natively |

---

## 5. Data model (Convex schema)

Create `convex/schema.ts`:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Dashboard users. Identity tables live inside the Robel auth component
  // (`components.auth`). This row mirrors profile data for app-level lookups
  // and keyed by the auth subject returned from `ctx.auth.getUserIdentity()`.
  users: defineTable({
    subject: v.string(),          // Robel auth user subject
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("owner")),
  }).index("by_subject", ["subject"]),

  // Discord guild (server) connected to this instance
  guilds: defineTable({
    discordGuildId: v.string(),
    name: v.string(),
    iconUrl: v.optional(v.string()),
    botToken: v.string(),         // encrypted at rest via Convex env vars
    publicKey: v.string(),
    applicationId: v.string(),
    installedByUserId: v.id("users"),
  }).index("by_discord_id", ["discordGuildId"]),

  // A form = a Discord slash command
  forms: defineTable({
    guildId: v.id("guilds"),
    // Discord command metadata
    commandName: v.string(),      // e.g. "post-job" (no slash, lowercase)
    commandDescription: v.string(),
    // Form config
    title: v.string(),
    description: v.optional(v.string()),
    fields: v.array(
      v.object({
        id: v.string(),            // stable ID for field referencing
        label: v.string(),
        type: v.union(
          v.literal("short"),      // TextInput SHORT
          v.literal("paragraph"),  // TextInput PARAGRAPH
        ),
        required: v.boolean(),
        placeholder: v.optional(v.string()),
        minLength: v.optional(v.number()),
        maxLength: v.optional(v.number()),
      })
    ),
    // Routing
    requiresApproval: v.boolean(),
    modQueueChannelId: v.optional(v.string()),  // Discord channel ID
    destinationChannelId: v.string(),           // where approved posts go
    destinationType: v.union(
      v.literal("text"),
      v.literal("forum")
    ),
    // Forum-specific
    forumTagId: v.optional(v.string()),         // tag to apply
    titleSource: v.union(
      v.literal("static"),                       // use titleTemplate
      v.literal("field")                         // use value of titleFieldId
    ),
    titleTemplate: v.optional(v.string()),       // e.g. "[HIRING] {role}"
    titleFieldId: v.optional(v.string()),
    // Optional role gates
    requiredRoleIds: v.optional(v.array(v.string())),
    modRoleIds: v.optional(v.array(v.string())), // can approve/deny
    // Cooldown
    cooldownSeconds: v.optional(v.number()),
    // Lifecycle
    published: v.boolean(),                      // registered with Discord?
    discordCommandId: v.optional(v.string()),
  })
    .index("by_guild", ["guildId"])
    .index("by_command", ["guildId", "commandName"]),

  // Raw submission from Discord modal
  submissions: defineTable({
    guildId: v.id("guilds"),
    formId: v.id("forms"),
    submitterId: v.string(),                     // Discord user ID
    submitterName: v.string(),
    values: v.record(v.string(), v.string()),    // fieldId → answer
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("auto_published")                // no approval required
    ),
    // Mod queue message (for edit/delete on decision)
    modQueueMessageId: v.optional(v.string()),
    modQueueChannelId: v.optional(v.string()),
    // Published post (if approved)
    publishedMessageId: v.optional(v.string()),
    publishedThreadId: v.optional(v.string()),   // for forum posts
    // Decision
    decidedBy: v.optional(v.string()),           // Discord user ID
    decidedAt: v.optional(v.number()),
    denyReason: v.optional(v.string()),
  })
    .index("by_form", ["formId"])
    .index("by_submitter", ["guildId", "submitterId"])
    .index("by_status", ["guildId", "status"]),

  // Immutable audit log
  auditLog: defineTable({
    guildId: v.id("guilds"),
    actorId: v.string(),                         // Discord user ID or "system"
    action: v.string(),                          // "submit", "approve", "deny", "publish"
    submissionId: v.optional(v.id("submissions")),
    formId: v.optional(v.id("forms")),
    metadata: v.optional(v.any()),
  }).index("by_guild", ["guildId"]),

  // Rate limiting per user per form
  cooldowns: defineTable({
    formId: v.id("forms"),
    submitterId: v.string(),
    lastSubmittedAt: v.number(),
  }).index("by_form_user", ["formId", "submitterId"]),
});
```

---

## 6. Convex API surface

### Queries (`convex/queries/`)

- `forms.list(guildId)` — all forms for the dashboard
- `forms.get(formId)` — single form for editing
- `submissions.listPending(guildId)` — mod queue view
- `submissions.listAll(guildId, { status?, formId? })` — audit log view
- `auditLog.list(guildId, { limit })` — recent events

### Mutations (`convex/mutations/`)

- `forms.create(args)` — draft a new form
- `forms.update(formId, patch)` — edit form config
- `forms.delete(formId)` — soft delete
- `submissions.insertFromDiscord(args)` — called from HTTP action
- `submissions.setDecision(submissionId, { status, decidedBy, denyReason })`

### Actions (`convex/actions/`)

Used for calling the Discord REST API (side effects allowed).

- `discord.registerCommand(formId)` — POST to Discord app commands endpoint
- `discord.unregisterCommand(commandId)`
- `discord.postToModQueue(submissionId)` — sends embed with Approve/Deny buttons
- `discord.publishSubmission(submissionId)` — creates forum thread or text message
- `discord.sendDM(userId, message)` — DM submitter
- `discord.fetchGuildMeta(guildId)` — get channels, roles, forum tags for dashboard dropdowns

### HTTP actions (`convex/http.ts`)

- `POST /interactions` — Discord's interactions endpoint. Verifies signature, routes by interaction type.
- Robel auth routes — registered in one line via `auth.http.add(http)` from `convex/auth.ts`. Covers GitHub OAuth start/callback and JWKS endpoints.

---

## 7. Discord interaction flow

### 7.1 Slash command triggered

```
User types /post-job in Discord
  ↓
Discord POSTs interaction to /interactions
  ↓
Convex httpAction:
  1. Verify Ed25519 signature (discord-interactions pkg)
  2. If PING, return PONG
  3. Look up form by commandName
  4. Respond with MODAL (convert form fields to Discord TextInputs)
```

### 7.2 Modal submitted

```
User fills modal, clicks Submit
  ↓
Discord POSTs modal_submit interaction
  ↓
Convex httpAction:
  1. Verify signature
  2. Extract field values from payload
  3. Check cooldown (block if still cooling)
  4. Insert submission with status="pending" (or "auto_published" if no approval)
  5. If requiresApproval:
     a. Defer response (type 5) to buy time
     b. Schedule action: postToModQueue
     c. Followup with "Submission received, pending review"
  6. If not requiresApproval:
     a. Schedule action: publishSubmission directly
     b. Respond with "Post live in #channel"
```

### 7.3 Mod clicks Approve

```
Mod clicks button in #mod-queue
  ↓
Discord POSTs message_component interaction with custom_id="approve:<submissionId>"
  ↓
Convex httpAction:
  1. Verify signature + mod role
  2. Defer response
  3. Call setDecision mutation → status="approved"
  4. Schedule action: publishSubmission → creates forum thread or sends message
  5. Schedule action: sendDM to submitter
  6. Edit mod queue message to show "Approved by @mod" (remove buttons)
  7. Append to audit log
```

### 7.4 Mod clicks Deny

```
Mod clicks Deny button
  ↓
Discord shows "reason" modal (custom_id="deny_reason:<submissionId>")
  ↓
Mod submits reason
  ↓
Convex httpAction:
  1. Verify + role check
  2. setDecision with status="denied" and denyReason
  3. sendDM to submitter with reason
  4. Edit queue message to show "Denied by @mod: <reason>"
  5. Audit log
```

### 7.5 Publishing to a Forum channel

Use Discord REST API `POST /channels/{channel_id}/threads` with:

```json
{
  "name": "{resolved title}",
  "message": {
    "embeds": [{
      "title": "...",
      "description": "formatted field answers",
      "author": { "name": "submitter name" },
      "timestamp": "ISO"
    }]
  },
  "applied_tags": ["<tag_id>"]
}
```

Title resolution:
- If `titleSource === "static"`: interpolate `titleTemplate` with field values via `{fieldId}` tokens.
- If `titleSource === "field"`: use `values[titleFieldId]`, truncated to 100 chars.

### 7.6 Publishing to a text channel

Use `POST /channels/{channel_id}/messages` with an embed. No `applied_tags`.

### 7.7 Auto-publish (no approval)

Same as 7.5 or 7.6, skipping the queue. Status jumps from "pending" to "auto_published" in one mutation.

---

## 8. Frontend spec

### 8.1 Routes

```
/                          → landing / redirect to /app
/auth/sign-in              → GitHub OAuth button
/app                       → dashboard home (forms list)
/app/forms/new             → new form wizard
/app/forms/:id             → form builder (edit)
/app/forms/:id/publish     → review and register with Discord
/app/submissions           → submission inbox with filters
/app/submissions/:id       → single submission detail
/app/audit                 → audit log
/app/settings              → guild connection, bot tokens, team
```

### 8.2 Design system (PostHog-inspired)

**Aesthetic:** playful-professional. Document-window feel. Slight retro warmth. Serious where it counts (data, forms).

**Color tokens.** Tailwind v4 uses CSS-first config. Tokens live in
`src/styles/index.css` under an `@theme` block. Shown here in legacy JS shape
for readability; the live copy is the CSS file.

```ts
// conceptual equivalent, see src/styles/index.css for the real tokens
export default {
  theme: {
    extend: {
      colors: {
        bg: "#EEEFE7",             // warm beige background
        surface: "#FFFFFF",        // card/panel
        ink: "#151515",            // primary text
        muted: "#676565",          // secondary text
        border: "#D6D3C7",         // soft border
        accent: "#F54E00",         // PostHog-style orange
        accentHover: "#D93F00",
        success: "#2D8E64",
        danger: "#C14040",
        warning: "#D4A200",
      },
      fontFamily: {
        sans: ["Matter", "Inter", "system-ui"],
        serif: ["'Playfair Display'", "Georgia"],
        mono: ["'JetBrains Mono'", "ui-monospace"],
      },
      borderRadius: {
        window: "12px",           // chunky, Mac-window-like
      },
      boxShadow: {
        window: "2px 3px 0 rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
      },
    },
  },
};
```

**Key UI patterns:**

- **Document window chrome.** Every major panel gets a top bar with a window-style title and optional tabs, mimicking the PostHog home.mdx editor frame.
- **Hand-drawn accent illustrations.** Consider using simple SVG doodles (optional, v2).
- **Subtle grid or paper texture on background** (optional, v2).
- **Generous whitespace, 16px base font, 1.5 line-height.**
- **Chunky buttons with soft shadows.**
- **Tab navigation over sidebar** for major sections, matching the PostHog reference.

### 8.3 Core components

```
/src/components
  /ui                              (shadcn primitives: Button, Input, Select, Dialog)
  /window
    WindowFrame.tsx                (title bar + content slot)
    WindowTabs.tsx                 (Phosphor-style tabs inside a window)
  /builder
    FormCanvas.tsx                 (dnd-kit sortable field list)
    FieldEditor.tsx                (edit a single field inline)
    FieldPreview.tsx               (modal preview pane)
    DiscordModalPreview.tsx        (WYSIWYG mimicking Discord modal)
    RoutingPanel.tsx               (channel + approval config)
    PublishPanel.tsx               (register with Discord button)
  /submissions
    SubmissionList.tsx
    SubmissionRow.tsx
    SubmissionDetail.tsx
  /auth
    SignIn.tsx
    Protected.tsx                  (wrapper)
  /layout
    AppShell.tsx
    TopNav.tsx
```

### 8.4 Form builder UX

The builder is the hero feature. Inspired by Typeform + Notion + PostHog:

1. **Left pane (30%):** live list of fields, drag to reorder, click to edit.
2. **Center pane (40%):** inline field editor — label, type, required, placeholder.
3. **Right pane (30%):** Discord modal preview, live-updating. Renders what users will actually see.

Below the three-pane editor, a **Routing tab** lets admin configure:
- Target channel (dropdown of the guild's channels, fetched via `discord.fetchGuildMeta`)
- Channel type auto-detected (text vs. forum)
- If forum: tag picker (dropdown of that forum's tags)
- If forum: title source (static template with field tokens, or "use field X")
- Approval toggle: on/off
- If on: mod queue channel picker
- Mod role picker (who can approve)
- Cooldown input

A **Publish tab** runs validation, registers the command with Discord, and flips `published=true`.

### 8.5 Submission inbox

Table view. Filter by form, status, date. Click row for detail. Detail view shows:
- Submitter (linked to Discord profile)
- Form name
- All answers rendered cleanly
- Decision history
- Quick actions (re-post, copy link to Discord message)

### 8.6 Audit log

Reverse-chronological feed. Each entry: actor, action, target, timestamp. Useful for mod accountability.

---

## 9. Auth flow (Robel Convex Auth + GitHub)

`@robelest/convex-auth` is a first-class Convex component. It owns its own
identity tables, JWKS, and HTTP routes. The app-level `users` table mirrors
profile fields for lookups and role checks.

### Setup (one time)

Run the CLI wizard after `npx convex dev` has created a deployment:

```bash
npx @robelest/convex-auth
```

The wizard:
- generates a JWT private key and JWKS, stored in Convex env vars
- creates `convex/convex.config.ts` registering the `auth` component
- creates `convex/auth.ts` with `createAuth(components.auth, { providers: [...] })`
- wires `auth.http.add(http)` into `convex/http.ts`

Reference: https://auth.estifanos.com/getting-started/installation/

### `convex/auth.ts` shape

```ts
import { createAuth } from "@robelest/convex-auth/component";
import { OAuth } from "@robelest/convex-auth/providers";
import { components } from "./_generated/api";
import { GitHub } from "arctic";

const github = new GitHub(
  process.env.AUTH_GITHUB_ID!,
  process.env.AUTH_GITHUB_SECRET!,
  null,
);

const auth = createAuth(components.auth, {
  providers: [
    OAuth("github", {
      provider: github,
      profile: async (tokens) => {
        const res = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${tokens.accessToken()}` },
        });
        const user = await res.json();
        return {
          id: String(user.id),
          email: user.email,
          name: user.name ?? user.login,
          image: user.avatar_url,
        };
      },
    }),
  ],
});

export { auth };
export const { signIn, signOut, store } = auth;
```

### Installed-package reality check

Per the `robel-auth` skill, the published package exports PascalCase classes
and an `OAuth(...)` factory. There is no first-party `github()` helper yet, so
we wrap `arctic`'s GitHub provider inside `OAuth()`. Revisit on every upgrade.

### Client flow

```
User hits /auth/sign-in
  ↓
Click "Continue with GitHub"
  ↓
client({ convex, api: api.auth }).signIn("github")
  ↓
Redirect to GitHub consent → back to the auth component's callback route
  ↓
Component stores session, app-level mutation upserts the `users` row by subject
  ↓
Redirect to /app
```

In the React app, `Protected.tsx` wraps `/app/*` routes and reads
`useCurrentUser()` (a hook over `useQuery(api.users.me)`).

**Admin gate:** first user to sign in becomes `role="owner"`. Subsequent
sign-ins require invite (Phase 3).

---

## 10. Discord Developer Portal setup

Before any code runs, you need:

1. Create a Discord Application at https://discord.com/developers/applications
2. Copy: **Application ID**, **Public Key**, **Bot Token**
3. Enable **Bot** tab, add bot, grant scopes: `bot`, `applications.commands`
4. Bot permissions: `Send Messages`, `Embed Links`, `Create Public Threads`, `Manage Messages`, `View Channels`, `Use Slash Commands`, `Manage Threads`
5. After deploying to Convex, paste `<convex_url>/interactions` into **Interactions Endpoint URL**
6. Use OAuth URL to invite bot to your server

---

## 11. Environment variables

Set via `npx convex env set`:

```
DISCORD_PUBLIC_KEY=<from developer portal>
DISCORD_APPLICATION_ID=<from developer portal>
DISCORD_BOT_TOKEN=<from developer portal>
DISCORD_CLIENT_SECRET=<from developer portal, OAuth2 tab>
DISCORD_BOT_PERMISSIONS=326417516544  # optional; default covers v1 needs
AUTH_GITHUB_ID=<github oauth app client id>
AUTH_GITHUB_SECRET=<github oauth app client secret>
JWT_PRIVATE_KEY=<generated by `npx @robelest/convex-auth`>
JWKS=<generated by `npx @robelest/convex-auth`>
APP_URL=https://forge.yourdomain.com
SITE_URL=https://forge.yourdomain.com
```

Add `${CONVEX_SITE_URL}/api/discord/install` as an OAuth2 redirect URI in the
Discord developer portal. Without it, the install callback from `/app/settings`
will fail with `redirect_uri_mismatch`.

`JWT_PRIVATE_KEY` and `JWKS` are written into the Convex deployment by the
Robel auth CLI; do not check them into source. `AUTH_GITHUB_ID` and
`AUTH_GITHUB_SECRET` match the Robel convention (not the legacy
`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`).

---

## 12. Phased build plan

### Phase 1: Foundations (day 1-2)
- [ ] Bootstrap Vite + React + Tailwind + Convex
- [ ] Install and register `@robelest/convex-auth` via `npx @robelest/convex-auth`
- [ ] Install and register `@convex-dev/static-hosting` via its setup wizard
- [ ] Install `@phosphor-icons/react`
- [ ] Set up Convex schema (all tables in section 5)
- [ ] Robel Convex Auth with GitHub OAuth, `Protected.tsx` gating `/app/*`
- [ ] Static hosting deploy via `npx @convex-dev/static-hosting deploy` (confirm domain works)

### Phase 2: Form builder shell (day 2-3)
- [ ] WindowFrame, WindowTabs primitives
- [ ] Forms list page + empty state
- [ ] New form flow (name + command name validation)
- [ ] Three-pane builder (fields list, editor, preview)
- [ ] Field CRUD with dnd-kit

### Phase 3: Discord bot core (day 3-4)
- [ ] `/interactions` httpAction with signature verify
- [ ] PING/PONG handling
- [ ] `discord.registerCommand` action
- [ ] Slash command → modal flow working end-to-end
- [ ] Modal submit → Convex submission insert
- [ ] Auto-publish path (no approval)

### Phase 4: Approval flow (day 4-5)
- [ ] Routing panel UI (channel/tag picker)
- [ ] `discord.postToModQueue` with Approve/Deny buttons
- [ ] Button interaction routing
- [ ] Deny reason modal
- [ ] `discord.publishSubmission` for both text and forum
- [ ] Forum title templating

### Phase 5: Polish (day 5-6)
- [ ] Submission inbox
- [ ] Audit log
- [ ] Cooldowns
- [ ] DM on approve/deny
- [ ] PostHog design refinement pass
- [ ] Error states, loading skeletons

### Phase 6: Production (day 6-7)
- [ ] Custom domain via Convex
- [ ] Production Discord application (separate from dev)
- [ ] Deploy docs (README)
- [ ] Rate limit abuse testing
- [ ] Signature verify fuzz test

**Total estimate:** 6-7 focused days, shippable MVP.

---

## 13. Security considerations

- **Ed25519 signature verification on every `/interactions` call.** Non-negotiable. Discord sends invalid signatures as tests; failing = endpoint disabled.
- **Bot token stored only in Convex env vars.** Never in client code, never in DB in plaintext.
- **Mod role check on every Approve/Deny button.** Don't trust `custom_id` alone; re-verify role from interaction payload.
- **Rate limit modal submissions per user.** Cooldown table prevents spam. Hard cap at 10/min per user globally.
- **Input sanitization.** Strip `@everyone`, `@here`, `<@&roleId>` from submitted content before embedding in published messages. Don't let users ping everyone.
- **Audit log is append-only.** Never delete entries.
- **Dashboard CSRF protection** via Robel Convex Auth defaults (state param on every OAuth round-trip, signed JWT sessions).

---

## 14. Open decisions

1. **Multi-guild support in v1?** `DECIDED: single guild`. Ships faster. Schema already carries `by_discord_id` so adding a guild switcher later is UI + routing work only. `guilds.current` returns the most recent row for the dashboard banner; swap to a per-user preference lookup when multi-guild ships.

2. **Discord install UX?** `DECIDED: full OAuth2 redirect flow`. Admin clicks Connect, a signed-in action mints a CSRF nonce, user bounces to `discord.com/api/oauth2/authorize`, Discord 302s back to `${CONVEX_SITE_URL}/api/discord/install`. The HTTP action consumes the nonce (recovering the admin's Forge user id), exchanges the OAuth code for a `guild` payload, and registers the row. Alternative considered: install URL without redirect + poll `GET /users/@me/guilds` with the bot token to let the admin pick from joined servers. Rejected because the redirect flow is a single click, teaches Discord's state convention, and makes the `installedByUserId` attribution accurate by construction.

2. **Forum tag picker — single tag or multiple?** Discord allows up to 5 tags per thread. v1 recommends single tag per form for simplicity. Extend to multi-select in v2.

3. **Edit after approval?** If a mod wants to tweak a submission before publishing, do we allow it? v1 says no (raw submitter content). v2 could add an "Edit before publish" modal.

4. **Notification preferences.** Should the submitter's approval DM be customizable per form? v1 says server-level default, v2 per-form.

5. **Form versioning.** If a form is edited after submissions exist, do old submissions show old or new schema? v1 stores the field config snapshot on each submission to preserve integrity.

---

## 15. File structure

```
forge/
├── convex/
│   ├── convex.config.ts           (app.use(auth) + app.use(staticHosting))
│   ├── schema.ts
│   ├── http.ts                    (Discord /interactions + auth.http.add)
│   ├── auth.ts                    (@robelest/convex-auth setup, GitHub OAuth)
│   ├── staticHosting.ts           (exposeUploadApi + exposeDeploymentQuery)
│   ├── users.ts                   (queries/mutations for app users table)
│   ├── forms.ts                   (queries + mutations)
│   ├── submissions.ts
│   ├── auditLog.ts
│   ├── actions/
│   │   └── discord.ts             (REST API calls)
│   └── lib/
│       ├── discord-types.ts       (Interaction, InteractionType enums)
│       ├── signature.ts           (Ed25519 verify wrapper)
│       ├── modal-builder.ts       (Form → Discord modal payload)
│       ├── embed-builder.ts       (Submission → Discord embed)
│       └── title-template.ts      (Interpolate field values)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── styles/
├── public/
├── package.json                   (includes `deploy` script for static hosting)
├── vite.config.ts                 (react + @tailwindcss/vite plugin)
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── .env.example
├── files.md                       (live index of project files)
├── changelog.md                   (keepachangelog.com format)
├── TASK.md                        (phase-by-phase task tracker)
└── README.md
```

---

## 16. Cursor prompt (drop-in)

When you open this in Cursor, paste this as your first prompt:

```
Read @forge-prd_1.md. Initialize a new Vite + React 19 + TypeScript + Tailwind
v4 project. Add Convex (`npx convex dev`), shadcn/ui, dnd-kit,
`@phosphor-icons/react`, and the `discord-interactions` package.

Run `npx @robelest/convex-auth` to register the auth component, then run
`npx @convex-dev/static-hosting setup` to register the static-hosting
component. Both write into `convex/convex.config.ts`, `convex/auth.ts`, and
`convex/http.ts`; keep their output and do not overwrite it.

Scaffold the remaining file structure from section 15. Create the Convex
schema from section 5. Wire up the /interactions HTTP action with signature
verification and PING/PONG handling as a first milestone.

Do not register any Discord commands yet. Do not implement the form builder UI
yet. Get the bot responding to a hardcoded /ping command with "pong" first.
Verify end-to-end with a local ngrok tunnel to the Convex dev deployment.

After that works, stop and ask me what to build next.
```

---

## 17. References

- Convex Discord bot walkthrough: https://stack.convex.dev/webhooks-with-convex
- Convex LLMs docs: https://docs.convex.dev/llms.txt
- Discord developer docs: https://docs.discord.com/developers/bots/overview
- Discord interactions guide: https://docs.discord.com/developers/guides/bots
- Discord forum thread API: https://discord.com/developers/docs/resources/channel#start-thread-in-forum-or-media-channel
- Robel Convex Auth docs: https://auth.estifanos.com/getting-started/installation/
- Robel Convex Auth source: https://github.com/robelest/convex-auth
- `@convex-dev/static-hosting` component: https://www.convex.dev/components/static-hosting/static-hosting.md
- `@convex-dev/static-hosting` source: https://github.com/get-convex/static-hosting
- Phosphor Icons: https://phosphoricons.com/
- `@phosphor-icons/react`: https://github.com/phosphor-icons/react
- `discord-interactions` npm: https://www.npmjs.com/package/discord-interactions
