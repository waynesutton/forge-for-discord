# Discord setup

How to create the Discord application, configure the bot, wire up the interactions endpoint, and install the bot into a server. Run this once per deployment (dev and prod are separate apps).

## Prerequisites

Before you start, make sure you have:

- A Convex deployment running (`npx convex dev` or a production deploy)
- Your Convex deployment URL (`VITE_CONVEX_URL`) and the matching HTTP actions URL (the `*.convex.site` URL, not `*.convex.cloud`). Both appear when `npx convex dev` boots.
- Admin access to a Discord server you can test against. A personal test server is fine.

If you do not yet have a `.convex.site` URL, Convex prints it during `npx convex dev`. It is also exposed to the backend as `process.env.CONVEX_SITE_URL`.

## 1. Create the Discord application

1. Go to https://discord.com/developers/applications and click **New Application**. Name it whatever you want. For dev vs production, create two separate applications so tokens and endpoints stay isolated.
2. On the **General Information** tab copy:
   - **Application ID** → goes to env as `DISCORD_APPLICATION_ID`
   - **Public Key** → goes to env as `DISCORD_PUBLIC_KEY`
3. Open the **OAuth2** tab and copy:
   - **Client Secret** (click Reset Secret if you need a fresh one) → goes to env as `DISCORD_CLIENT_SECRET`

## 2. Create the bot user

1. Open the **Bot** tab and click **Add Bot**.
2. Under **Token**, click **Reset Token** and copy the value. This goes to env as `DISCORD_BOT_TOKEN`. You only see the token once, so paste it somewhere safe immediately.
3. Leave **Privileged Gateway Intents** all **off**. Forge never uses the gateway. It only handles HTTP interactions.
   - `Presence Intent`: off
   - `Server Members Intent`: off
   - `Message Content Intent`: off
4. Leave **Public Bot** on if you eventually want to share the invite link. Leave it off if this is a private install.

## 3. Set the interactions endpoint

This is the URL Discord POSTs to for every slash command, modal submit, and button click.

1. Still on the Discord application page, open **General Information**.
2. Scroll to **Interactions Endpoint URL**.
3. Paste `<your convex site url>/interactions`. Example:
   ```
   https://your-deployment-name.convex.site/interactions
   ```
4. Click **Save Changes**. Discord will immediately send a verification PING to the URL and reject it if the signature check fails.

Forge handles the PING in `convex/http.ts`:

```15:42:convex/http.ts
http.route({
  path: "/interactions",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");
    const rawBody = await request.text();
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!signature || !timestamp || !publicKey) {
      return new Response("Bad request", { status: 401 });
    }

    const isValid = await verifyKey(rawBody, signature, timestamp, publicKey);
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(rawBody) as { type: number };
    // PING
    if (payload.type === 1) {
      return Response.json({ type: 1 });
    }
```

If Discord rejects the URL, the most common causes are:
- `DISCORD_PUBLIC_KEY` not set in Convex env, or set to the wrong value
- URL pointing at `.convex.cloud` instead of `.convex.site`
- `npx convex dev` not running (for local dev use `ngrok`, see below)

## 4. Set Convex environment variables

Forge reads Discord config from Convex env, not `.env.local`. Set them with the CLI:

```bash
npx convex env set DISCORD_APPLICATION_ID <application id>
npx convex env set DISCORD_PUBLIC_KEY <public key>
npx convex env set DISCORD_BOT_TOKEN <bot token>
npx convex env set DISCORD_CLIENT_SECRET <client secret>
```

Optional override for the bot permissions bitmask (see section 5 for the default and what it contains):

```bash
npx convex env set DISCORD_BOT_PERMISSIONS <bitmask>
```

Full env template lives in `.env.example`. Everything on the Discord side is server-only and must live in Convex env, never in `.env.local` or client code.

## 5. Bot permissions

Forge asks for these permissions during install. They come from PRD section 10 and map to the checkboxes in the Discord portal.

| Category | Permission | Why |
|---|---|---|
| General | View Channels | Dashboard needs to list channels, roles, forum tags via `discord.fetchGuildMeta` |
| Text | Send Messages | Post to mod queue and text destinations |
| Text | Embed Links | Render submission embeds |
| Text | Manage Messages | Edit mod queue message after Approve/Deny (remove buttons, mark outcome) |
| Text | Create Public Threads | Publish to Forum channels via `POST /channels/{id}/threads` |
| Text | Manage Threads | Apply forum tags, edit threads after approval |
| Text | Send Messages in Threads | Post inside forum threads and DM-style reply flows |

**Scopes** (separate from permissions, set in the OAuth URL):

- `bot`
- `applications.commands`

**Voice permissions**: none required. Voice is a PRD non-goal.

**Message Content Intent**: leave **off**. Forge never reads free-form messages.

### Default bitmask

The install URL uses this default, set in `convex/discord.ts`:

```30:33:convex/discord.ts
// Computing the final integer ahead of time avoids shipping BigInt math to
// the client and lets the admin override via env if their server needs a
// different set.
const DEFAULT_PERMISSIONS = "328565051456";
```

`328565051456` includes all seven permissions:

| Bit | Value | Permission |
|---|---|---|
| 10 | 1,024 | View Channels |
| 11 | 2,048 | Send Messages |
| 13 | 8,192 | Manage Messages |
| 14 | 16,384 | Embed Links |
| 34 | 17,179,869,184 | Manage Threads |
| 35 | 34,359,738,368 | Create Public Threads |
| 38 | 274,877,906,944 | Send Messages in Threads |

Sum: `1,024 + 2,048 + 8,192 + 16,384 + 17,179,869,184 + 34,359,738,368 + 274,877,906,944 = 328,565,051,456`.

For the exact seven permissions listed in PRD section 10 (which also names Use Slash Commands, bit 31), add `2,147,483,648` to get `330,712,535,104`. The `applications.commands` OAuth scope usually makes this bit redundant, but some servers enforce it.

## 6. Install the bot into your server

You do not paste an invite URL manually. Forge mints a signed one for you.

1. Deploy the backend: `npx convex dev` locally, or `npx convex deploy` in production.
2. Start the frontend: `npm run dev`.
3. Sign in with GitHub at `/auth/sign-in`. Your account must be `@convex.dev` per the access control PRD (`prds/access-control.md`).
4. Go to `/app/settings` and click **Connect server**.
5. The action `api.discord.generateInstallUrl` mints a CSRF nonce, stores it in the `oauthStates` table (10 minute TTL), and redirects you to Discord's OAuth authorize URL with `scope=bot applications.commands` and `permissions=<bitmask>`.
6. Choose the server, confirm permissions, click Authorize.
7. Discord 302s you to `<convex site>/api/discord/install?code=...&state=...&guild_id=...`.
8. The HTTP callback (see `convex/http.ts` section 3) consumes the nonce, exchanges the code, and writes a `guilds` row. It then redirects you to `/app/settings?installed=<guildId>` with a success banner. On any failure it redirects to `/app/settings?error=<code>`.

After success, `/app` shows the connected guild banner and `/app/settings` lists the guild.

## 7. Local development with ngrok

Discord will not accept an interactions endpoint on `localhost`. For local dev against a real Discord app:

1. Run `npx convex dev`. Copy the `.convex.site` URL it prints.
2. That URL is already public, so **you do not need ngrok** for the interactions endpoint. Convex exposes your dev deployment's HTTP actions on the internet by default.
3. Paste `<dev site url>/interactions` into the Discord portal. Keep `DISCORD_PUBLIC_KEY` in sync with the dev application.

Only reach for `ngrok` if you are running a non-Convex HTTP layer. Forge does not need it.

## 8. Production vs dev applications

Keep two Discord applications. Mixing them is the single most common cause of lost keys and broken signature verification.

| Env | Application | Interactions URL | Bot token | Convex deployment |
|---|---|---|---|---|
| dev | "Forge (dev)" | `https://<dev>.convex.site/interactions` | dev-only | `npx convex dev` deployment |
| prod | "Forge" | `https://<prod>.convex.site/interactions` | prod-only | `npx convex deploy` deployment |

Set env vars on each Convex deployment separately:

```bash
npx convex env set DISCORD_APPLICATION_ID <value>            # dev
npx convex env set DISCORD_APPLICATION_ID <value> --prod     # prod
```

## 9. Verify the install

After you authorize the bot, run this quick checklist:

- [ ] `/app/settings` shows the guild in the Connected servers list
- [ ] The bot appears in your Discord server's member list
- [ ] In the server's Integrations settings, Forge has the scopes `bot` and `applications.commands`
- [ ] The bot has the seven permissions from section 5 (or your overridden set) in the target channel
- [ ] Discord application portal shows the interactions endpoint URL as verified

## 10. Troubleshooting

**"Interactions Endpoint URL could not be validated"**
- Make sure `DISCORD_PUBLIC_KEY` is set in Convex env and matches the portal exactly.
- Confirm the URL is `.convex.site`, not `.convex.cloud`.
- Watch the Convex logs: signature failures show up as `Invalid signature` 401 responses.

**Callback lands on `/app/settings?error=invalid_state`**
- CSRF nonce expired (10 minute TTL) or was already consumed.
- Click Connect server again and complete the flow in one go.

**Callback lands on `/app/settings?error=discord_missing_guild`**
- The OAuth request was missing the `bot` scope. Check that `generateInstallUrl` still sends `scope=bot applications.commands`.

**Callback lands on `/app/settings?error=server_not_configured`**
- One of `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID` is missing in Convex env. Set them with `npx convex env set` and retry.

**Bot is in the server but commands do not work**
- Phase 3 command registration is not live yet. The PRD tracks this in `TASK.md` under "Discord bot core".

## References

- Discord developer portal: https://discord.com/developers/applications
- Discord interactions guide: https://docs.discord.com/developers/guides/bots
- Discord permission bitmask reference: https://discord.com/developers/docs/topics/permissions
- Convex HTTP actions: https://docs.convex.dev/functions/http-actions
- Forge PRD section 10 (Discord Developer Portal): `prds/forge-prd_1.md`
- Access control: `prds/access-control.md`
