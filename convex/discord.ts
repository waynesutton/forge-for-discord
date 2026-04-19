// Discord REST client. Runs on the V8 runtime (no Node built-ins needed here)
// so we skip `"use node"`. All calls use global `fetch`.
//
// Responsibilities:
//   Phase 2:
//     - Generate the bot install OAuth URL with a signed-in admin tied to
//       it via a CSRF nonce in `oauthStates`.
//     - Exchange the OAuth `code` for a bot access token + `guild` payload.
//     - Register or update a guild slash command for a published form.
//     - Refresh guild channel and role caches.
//   Phase 3 (this file):
//     - Route new submissions to either the mod queue or straight to the
//       destination.
//     - Post the review embed (with Approve/Deny buttons).
//     - Publish approved/auto_published submissions to a text channel or a
//       forum thread.
//     - DM the submitter on each decision.

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  action,
  internalAction,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAllowedViewer } from "./lib/auth";

const DISCORD_AUTHORIZE_URL = "https://discord.com/api/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_API_BASE = "https://discord.com/api/v10";

// Bot permissions bitmask. Default covers the seven permissions Forge needs
// in v1 for slash-command submission, mod queue embeds, and forum publishing:
//   View Channels            (0x00000400)
//   Send Messages            (0x00000800)
//   Manage Messages          (0x00002000)
//   Embed Links              (0x00004000)
//   Manage Threads           (0x0000000400000000n)
//   Create Public Threads    (0x0000000800000000n)
//   Send Messages in Threads (0x0000004000000000n)
//
// Computing the final integer ahead of time avoids shipping BigInt math to
// the client and lets the admin override via env if their server needs a
// different set.
const DEFAULT_PERMISSIONS = "328565051456";

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope: string;
  guild?: {
    id: string;
    name: string;
    icon: string | null;
  };
};

type DiscordCommandResponse = {
  id: string;
};

type DiscordGuildChannelResponse = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  position?: number;
  available_tags?: Array<{
    id: string;
    name: string;
  }>;
};

type DiscordGuildRoleResponse = {
  id: string;
  name: string;
  position: number;
  color?: number;
  managed: boolean;
};

// Parse and normalize a client-supplied origin for the Discord install
// callback. Only http/https are allowed; we store `URL.origin` so any
// path, query, or fragment the client might have tacked on is stripped.
// Returns `undefined` when input is missing or invalid so the caller can
// fall back to the request origin in the HTTP callback.
function sanitizeReturnOrigin(input: string | undefined): string | undefined {
  if (!input) return undefined;
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}

// Admin-initiated. Authenticated: the signed-in admin is tied to the nonce
// so the HTTP callback can figure out which user's workspace to register the
// guild into. Returns the full Discord authorize URL so the client can point
// `window.location.href` at it.
export const generateInstallUrl = action({
  args: {
    // Frontend passes `window.location.origin` so the HTTP callback can 302
    // back to the same domain the admin started from. Optional for backward
    // compat with older clients; when absent the callback falls back to
    // APP_URL / request origin.
    returnOrigin: v.optional(v.string()),
  },
  returns: v.object({ url: v.string(), expiresAt: v.number() }),
  handler: async (
    ctx,
    args,
  ): Promise<{ url: string; expiresAt: number }> => {
    await requireAllowedViewer(ctx);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "unauthenticated" });
    }

    const appId = process.env.DISCORD_APPLICATION_ID;
    const siteUrl = process.env.CONVEX_SITE_URL;
    if (!appId || !siteUrl) {
      throw new ConvexError({
        code: "config_missing",
        message:
          "DISCORD_APPLICATION_ID and CONVEX_SITE_URL must be set in Convex env.",
      });
    }

    // Resolve the Forge-level user so the nonce carries a stable row id, not
    // a Robel subject string. Actions cannot reach `ctx.db`; do it via a
    // public query.
    const me = await ctx.runQuery(internal.users.lookupBySubject, {
      subject: identity.subject,
    });
    if (!me) {
      throw new ConvexError({ code: "unknown_user" });
    }

    // Validate the caller-supplied origin before persisting it. Parse as
    // URL, require http(s), and store only the `.origin` to avoid persisting
    // user-controlled paths or fragments. Anything malformed is dropped so
    // the callback falls back to APP_URL / request origin.
    const sanitizedReturnOrigin = sanitizeReturnOrigin(args.returnOrigin);

    const { state, expiresAt } = await ctx.runMutation(
      internal.oauthStates.create,
      {
        userId: me._id,
        kind: "discord_install",
        returnOrigin: sanitizedReturnOrigin,
      },
    );

    const redirectUri = `${siteUrl}/api/discord/install`;
    const permissions =
      process.env.DISCORD_BOT_PERMISSIONS ?? DEFAULT_PERMISSIONS;

    const params = new URLSearchParams({
      client_id: appId,
      response_type: "code",
      scope: "bot applications.commands",
      permissions,
      redirect_uri: redirectUri,
      state,
    });

    return {
      url: `${DISCORD_AUTHORIZE_URL}?${params.toString()}`,
      expiresAt,
    };
  },
});

export const registerCommand = action({
  args: {
    formId: v.id("forms"),
  },
  returns: v.object({
    commandId: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAllowedWorkspaceUser(ctx);

    const publishTarget = await ctx.runQuery(internal.forms.getForPublish, {
      formId: args.formId,
    });
    if (!publishTarget) {
      throw new ConvexError({ code: "form_not_found" });
    }

    const url = publishTarget.discordCommandId
      ? `${DISCORD_API_BASE}/applications/${publishTarget.applicationId}/guilds/${publishTarget.discordGuildId}/commands/${publishTarget.discordCommandId}`
      : `${DISCORD_API_BASE}/applications/${publishTarget.applicationId}/guilds/${publishTarget.discordGuildId}/commands`;
    const method = publishTarget.discordCommandId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bot ${publishTarget.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: publishTarget.commandName,
        description: publishTarget.commandDescription,
        type: 1,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("discord_register_command_failed", {
        status: res.status,
        body: text.slice(0, 500),
      });
      throw new ConvexError({
        code: "discord_register_command_failed",
        status: res.status,
      });
    }

    const data = (await res.json()) as DiscordCommandResponse;
    if (!data.id) {
      throw new ConvexError({ code: "discord_missing_command_id" });
    }

    await ctx.runMutation(internal.forms.setPublicationState, {
      formId: publishTarget.formId,
      published: true,
      discordCommandId: data.id,
    });

    return { commandId: data.id };
  },
});

export const refreshGuildChannels = action({
  args: {
    guildId: v.id("guilds"),
  },
  returns: v.object({
    count: v.number(),
    syncedAt: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ count: number; syncedAt: number }> => {
    await requireAllowedWorkspaceUser(ctx);

    const target = await ctx.runQuery(internal.guilds.getInstallForChannelSync, {
      guildId: args.guildId,
    });
    if (!target) {
      throw new ConvexError({ code: "guild_not_found" });
    }

    const res = await fetch(
      `${DISCORD_API_BASE}/guilds/${target.discordGuildId}/channels`,
      {
        headers: {
          Authorization: `Bot ${target.botToken}`,
        },
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("discord_channels_refresh_failed", {
        status: res.status,
        body: text.slice(0, 500),
      });
      throw new ConvexError({
        code: "discord_channels_refresh_failed",
        status: res.status,
      });
    }

    const payload = (await res.json()) as Array<DiscordGuildChannelResponse>;
    const categories = new Map(
      payload
        .filter((channel) => channel.type === 4)
        .map((channel) => [channel.id, channel.name]),
    );
    const channels = payload
      .filter((channel) => channel.type === 0 || channel.type === 4 || channel.type === 15)
      .map((channel) => ({
        discordChannelId: channel.id,
        name: channel.name,
        type: mapChannelType(channel.type),
        parentId: channel.parent_id ?? undefined,
        parentName: channel.parent_id ? categories.get(channel.parent_id) : undefined,
        position: channel.position ?? 0,
        availableTags:
          channel.type === 15
            ? channel.available_tags?.map((tag) => ({
                id: tag.id,
                name: tag.name,
              }))
            : undefined,
      }))
      .sort((left, right) => left.position - right.position);
    const syncedAt = Date.now();

    return await ctx.runMutation(internal.guilds.replaceChannelsCache, {
      guildId: args.guildId,
      channels,
      syncedAt,
    });
  },
});

export const refreshGuildRoles = action({
  args: {
    guildId: v.id("guilds"),
  },
  returns: v.object({
    count: v.number(),
    syncedAt: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ count: number; syncedAt: number }> => {
    await requireAllowedWorkspaceUser(ctx);

    const target = await ctx.runQuery(internal.guilds.getInstallForRoleSync, {
      guildId: args.guildId,
    });
    if (!target) {
      throw new ConvexError({ code: "guild_not_found" });
    }

    const res = await fetch(
      `${DISCORD_API_BASE}/guilds/${target.discordGuildId}/roles`,
      {
        headers: {
          Authorization: `Bot ${target.botToken}`,
        },
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("discord_roles_refresh_failed", {
        status: res.status,
        body: text.slice(0, 500),
      });
      throw new ConvexError({
        code: "discord_roles_refresh_failed",
        status: res.status,
      });
    }

    const payload = (await res.json()) as Array<DiscordGuildRoleResponse>;
    const roles = payload
      .filter((role) => role.name !== "@everyone")
      .map((role) => ({
        discordRoleId: role.id,
        name: role.name,
        position: role.position,
        color: role.color,
        managed: role.managed,
      }))
      .sort((left, right) => right.position - left.position);
    const syncedAt = Date.now();

    return await ctx.runMutation(internal.guilds.replaceRolesCache, {
      guildId: args.guildId,
      roles,
      syncedAt,
    });
  },
});

// Called from the HTTP action after it consumes the CSRF nonce. Exchanges
// the OAuth `code` for a token payload that includes the `guild` metadata
// Discord attaches when `bot` scope is granted. Returns the shape the
// registration mutation expects. Separated from the HTTP action so the
// network call is testable in isolation. Internal because the HTTP route
// already authenticated the caller via the CSRF nonce and the client must
// never hit this directly.
export const exchangeInstallCode = internalAction({
  args: {
    code: v.string(),
  },
  returns: v.object({
    guild: v.object({
      id: v.string(),
      name: v.string(),
      iconUrl: v.optional(v.string()),
    }),
  }),
  handler: async (_ctx, args) => {
    const appId = process.env.DISCORD_APPLICATION_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const siteUrl = process.env.CONVEX_SITE_URL;
    if (!appId || !clientSecret || !siteUrl) {
      throw new ConvexError({
        code: "config_missing",
        message:
          "DISCORD_APPLICATION_ID, DISCORD_CLIENT_SECRET, and CONVEX_SITE_URL must be set.",
      });
    }

    const body = new URLSearchParams({
      client_id: appId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: args.code,
      redirect_uri: `${siteUrl}/api/discord/install`,
    });

    const res = await fetch(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("discord_exchange_failed", {
        status: res.status,
        body: text.slice(0, 500),
      });
      throw new ConvexError({
        code: "discord_exchange_failed",
        status: res.status,
      });
    }

    const data = (await res.json()) as DiscordTokenResponse;
    if (!data.guild) {
      throw new ConvexError({
        code: "discord_missing_guild",
        message:
          "Discord OAuth response did not include a guild. Did the admin authorize the bot scope?",
      });
    }

    // CDN URL construction per Discord docs:
    // https://cdn.discordapp.com/icons/<guild.id>/<icon>.png
    const iconUrl = data.guild.icon
      ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png`
      : undefined;

    return {
      guild: {
        id: data.guild.id,
        name: data.guild.name,
        iconUrl,
      },
    };
  },
});

async function requireAllowedWorkspaceUser(ctx: ActionCtx) {
  return await requireAllowedViewer(ctx);
}

function mapChannelType(type: number): "text" | "forum" | "category" {
  switch (type) {
    case 0:
      return "text";
    case 4:
      return "category";
    case 15:
      return "forum";
    default:
      throw new ConvexError({ code: "unsupported_channel_type", type });
  }
}

// ---------------------------------------------------------------------------
// Phase 3: submission routing, mod queue, publish, DM.
// ---------------------------------------------------------------------------

// Discord embed brand colors used across the review and publish flow. Kept
// hard-coded so we do not depend on per-guild theme overrides.
const EMBED_COLOR_PENDING = 0x5865f2;
const EMBED_COLOR_APPROVED = 0x3ba55d;
const EMBED_COLOR_DENIED = 0xed4245;

type RouteContext = NonNullable<
  Awaited<ReturnType<typeof fetchRouteContext>>
>;

async function fetchRouteContext(
  ctx: ActionCtx,
  submissionId: import("./_generated/dataModel").Id<"submissions">,
) {
  return ctx.runQuery(internal.submissions.routeContext, { submissionId });
}

// Entry point scheduled from `insertFromDiscord`. Decides between the mod
// queue path and the auto-publish path. Separate action so the write
// transaction can commit before any Discord REST call runs.
export const routeSubmission = internalAction({
  args: {
    submissionId: v.id("submissions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await fetchRouteContext(ctx, args.submissionId);
    if (!context) return null;

    if (context.form.requiresApproval) {
      if (!context.form.modQueueChannelId) {
        await ctx.runMutation(internal.submissions.logRoutingSkip, {
          submissionId: args.submissionId,
          reason: "mod_queue_channel_missing",
        });
        return null;
      }
      await postToModQueueImpl(ctx, context);
      return null;
    }

    await publishSubmissionImpl(ctx, context);
    return null;
  },
});

// Scheduled from `recordDecision`. Rewrites the existing mod queue embed so
// the same Discord message shows the final decision and drops the Approve
// and Deny buttons. No-op if the mod queue post never happened (e.g.,
// channel was missing when the submission came in).
export const updateModQueueMessage = internalAction({
  args: {
    submissionId: v.id("submissions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await fetchRouteContext(ctx, args.submissionId);
    if (!context) return null;
    const { submission, guild } = context;
    if (!submission.modQueueChannelId || !submission.modQueueMessageId) {
      return null;
    }

    const state =
      submission.status === "approved"
        ? "approved"
        : submission.status === "denied"
          ? "denied"
          : "pending";
    const embed = buildSubmissionEmbed(context, state);

    const res = await fetch(
      `${DISCORD_API_BASE}/channels/${submission.modQueueChannelId}/messages/${submission.modQueueMessageId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${guild.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ embeds: [embed], components: [] }),
      },
    );
    if (!res.ok) {
      await ctx.runMutation(internal.submissions.logRoutingSkip, {
        submissionId: submission._id,
        reason: "mod_queue_update_failed",
        detail: `${res.status}`,
      });
    }
    return null;
  },
});

// Scheduled from `recordDecision` on approve, and also used directly in the
// auto-publish path via the shared impl. Re-reads the context so it always
// posts the latest values.
export const publishSubmission = internalAction({
  args: {
    submissionId: v.id("submissions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await fetchRouteContext(ctx, args.submissionId);
    if (!context) return null;
    await publishSubmissionImpl(ctx, context);
    return null;
  },
});

// Scheduled from `recordDecision` on approve and deny. Opens a DM channel
// with the submitter and posts a short status message. Silently audits when
// Discord refuses (closed DMs, blocked bot).
export const sendDecisionDM = internalAction({
  args: {
    submissionId: v.id("submissions"),
    decision: v.union(v.literal("approved"), v.literal("denied")),
    denyReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await fetchRouteContext(ctx, args.submissionId);
    if (!context) return null;
    const { submission, form, guild } = context;

    try {
      const dmChannelRes = await fetch(
        `${DISCORD_API_BASE}/users/@me/channels`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${guild.botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ recipient_id: submission.submitterId }),
        },
      );
      if (!dmChannelRes.ok) {
        await ctx.runMutation(internal.submissions.logRoutingSkip, {
          submissionId: args.submissionId,
          reason: "dm_open_failed",
          detail: `${dmChannelRes.status}`,
        });
        return null;
      }
      const dmChannel = (await dmChannelRes.json()) as { id: string };

      const content =
        args.decision === "approved"
          ? `Your submission to **${escapeMarkdown(form.title)}** was approved.`
          : `Your submission to **${escapeMarkdown(form.title)}** was denied${
              args.denyReason ? `: ${escapeMarkdown(args.denyReason)}` : "."
            }`;

      const postRes = await fetch(
        `${DISCORD_API_BASE}/channels/${dmChannel.id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${guild.botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: truncate(content, 1900) }),
        },
      );
      if (!postRes.ok) {
        await ctx.runMutation(internal.submissions.logRoutingSkip, {
          submissionId: args.submissionId,
          reason: "dm_send_failed",
          detail: `${postRes.status}`,
        });
      }
    } catch (err) {
      await ctx.runMutation(internal.submissions.logRoutingSkip, {
        submissionId: args.submissionId,
        reason: "dm_exception",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
    return null;
  },
});

async function postToModQueueImpl(ctx: ActionCtx, context: RouteContext) {
  const { submission, form, guild } = context;
  const channelId = form.modQueueChannelId;
  if (!channelId) return;

  const embed = buildSubmissionEmbed(context, "pending");
  const components = buildReviewComponents(submission._id);

  const res = await fetch(
    `${DISCORD_API_BASE}/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${guild.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ embeds: [embed], components }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    await ctx.runMutation(internal.submissions.logRoutingSkip, {
      submissionId: submission._id,
      reason: "mod_queue_post_failed",
      detail: `${res.status}:${text.slice(0, 200)}`,
    });
    return;
  }
  const message = (await res.json()) as { id: string };
  await ctx.runMutation(internal.submissions.markModQueuePosted, {
    submissionId: submission._id,
    messageId: message.id,
    channelId,
  });
}

async function publishSubmissionImpl(ctx: ActionCtx, context: RouteContext) {
  const { submission, form, guild } = context;

  if (!form.destinationChannelId || !form.destinationType) {
    await ctx.runMutation(internal.submissions.logRoutingSkip, {
      submissionId: submission._id,
      reason: "publish_skipped_destination_missing",
    });
    return;
  }

  const embed = buildSubmissionEmbed(
    context,
    submission.status === "denied" ? "denied" : "approved",
    "destination",
  );

  // Ticket-mode submissions get moderator action buttons (claim, resolve,
  // close, reopen) attached to the published message and a ticket-aware
  // footer/color. Regular forms publish a plain embed.
  const ticketComponents = form.ticketMode
    ? buildTicketComponents(
        submission._id,
        (submission.ticketStatus ?? "open") as TicketLifecycleStatus,
        Boolean(submission.assignedToUserId),
      )
    : undefined;
  if (form.ticketMode) {
    const footer = buildTicketFooter(context);
    embed.footer = { text: truncate(footer.text, 2048) };
    embed.color = footer.color;
  }

  // Prepend a clickable link to the submitter unless the form opts out.
  // `allowed_mentions.parse = []` makes the handle render as a pill without
  // actually pinging the user so the channel stays quiet.
  const linkSubmitter = form.linkSubmitterOnPublish !== false;
  const messageContent =
    linkSubmitter && submission.submitterId
      ? `Submitted by <@${submission.submitterId}>`
      : undefined;
  const allowedMentions = messageContent ? { parse: [] as Array<never> } : undefined;

  if (form.destinationType === "text") {
    const textBody: Record<string, unknown> = { embeds: [embed] };
    if (messageContent) {
      textBody.content = messageContent;
      textBody.allowed_mentions = allowedMentions;
    }
    if (ticketComponents) {
      textBody.components = ticketComponents;
    }
    const res = await fetch(
      `${DISCORD_API_BASE}/channels/${form.destinationChannelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${guild.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(textBody),
      },
    );
    if (!res.ok) {
      await ctx.runMutation(internal.submissions.logRoutingSkip, {
        submissionId: submission._id,
        reason: "publish_text_failed",
        detail: `${res.status}`,
      });
      return;
    }
    const message = (await res.json()) as { id: string };
    await ctx.runMutation(internal.submissions.markPublished, {
      submissionId: submission._id,
      messageId: message.id,
    });
    return;
  }

  if (form.destinationType === "forum") {
    const title = resolveForumTitle(context);
    const starterMessage: Record<string, unknown> = { embeds: [embed] };
    if (messageContent) {
      starterMessage.content = messageContent;
      starterMessage.allowed_mentions = allowedMentions;
    }
    if (ticketComponents) {
      starterMessage.components = ticketComponents;
    }
    const body: Record<string, unknown> = {
      name: truncate(title, 90),
      message: starterMessage,
    };
    if (form.forumTagId) {
      body.applied_tags = [form.forumTagId];
    }

    const res = await fetch(
      `${DISCORD_API_BASE}/channels/${form.destinationChannelId}/threads`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${guild.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      await ctx.runMutation(internal.submissions.logRoutingSkip, {
        submissionId: submission._id,
        reason: "publish_forum_failed",
        detail: `${res.status}`,
      });
      return;
    }
    // Forum thread response includes the thread id; the starter message id
    // lives under `message.id` when present.
    const thread = (await res.json()) as {
      id: string;
      message?: { id?: string };
    };
    await ctx.runMutation(internal.submissions.markPublished, {
      submissionId: submission._id,
      threadId: thread.id,
      messageId: thread.message?.id,
    });
  }
}

// Build the shared review/publish embed. `state` drives the color and footer
// so the same submission renders consistently across mod queue and publish.
function buildSubmissionEmbed(
  context: RouteContext,
  state: "pending" | "approved" | "denied",
  // `mod_queue` posts include every field so mods can contact the submitter.
  // `destination` posts drop private field types (email today) to honor the
  // "private by default" promise shown next to the Email field picker. The
  // dashboard still shows everything because it is admin-only.
  audience: "mod_queue" | "destination" = "mod_queue",
) {
  const { submission, form } = context;
  const fieldLookup = new Map(form.fields.map((f) => [f.id, f]));

  const fields: Array<{ name: string; value: string; inline: boolean }> = [];
  for (const field of form.fields) {
    if (audience === "destination" && isPrivateFieldType(field.type)) continue;
    const raw = submission.values[field.id] ?? "";
    fields.push({
      name: truncate(field.label || field.id, 256),
      value: formatFieldValue(field, raw),
      inline: false,
    });
  }
  for (const [fieldId, value] of Object.entries(submission.values)) {
    const known = fieldLookup.get(fieldId);
    if (known) continue;
    if (!value) continue;
    fields.push({
      name: truncate(fieldId, 256),
      value: truncate(escapeMarkdown(value), 1024),
      inline: false,
    });
  }

  let color = EMBED_COLOR_PENDING;
  let footerText = "Pending review";
  // Undefined defaults to true so existing forms keep the moderator name.
  const showModerator = form.showModeratorInFooter !== false;
  if (state === "approved") {
    color = EMBED_COLOR_APPROVED;
    footerText =
      showModerator && submission.decidedBy
        ? `Approved by ${submission.decidedBy}`
        : "Approved";
  } else if (state === "denied") {
    color = EMBED_COLOR_DENIED;
    footerText =
      showModerator && submission.decidedBy
        ? `Denied by ${submission.decidedBy}`
        : "Denied";
    if (submission.denyReason) {
      fields.push({
        name: "Deny reason",
        value: truncate(submission.denyReason, 1024),
        inline: false,
      });
    }
  }

  return {
    title: truncate(form.title, 256),
    description: form.description
      ? truncate(form.description, 4096)
      : undefined,
    color,
    author: { name: truncate(submission.submitterName, 256) },
    fields: fields.slice(0, 25),
    footer: { text: truncate(footerText, 2048) },
    timestamp: new Date(submission._creationTime).toISOString(),
  };
}

function buildReviewComponents(submissionId: string) {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: "Approve",
          custom_id: `approve:${submissionId}`,
        },
        {
          type: 2,
          style: 4,
          label: "Deny",
          custom_id: `deny:${submissionId}`,
        },
      ],
    },
  ];
}

type TicketLifecycleStatus = "open" | "in_progress" | "resolved" | "closed";

// Moderator-facing action buttons attached to a published ticket message.
// The button row is state-aware so we never offer an action that would
// be rejected by the mutation (e.g., no Resolve once the ticket is
// already closed). Returns undefined when ticket mode is off so the
// publish path can skip the `components` field entirely.
function buildTicketComponents(
  submissionId: string,
  status: TicketLifecycleStatus,
  hasAssignee: boolean,
): Array<Record<string, unknown>> | undefined {
  const buttons: Array<Record<string, unknown>> = [];

  if (status === "closed" || status === "resolved") {
    buttons.push({
      type: 2,
      style: 2,
      label: "Reopen",
      custom_id: `ticket:reopen:${submissionId}`,
    });
    return [{ type: 1, components: buttons }];
  }

  if (hasAssignee) {
    buttons.push({
      type: 2,
      style: 2,
      label: "Unclaim",
      custom_id: `ticket:unclaim:${submissionId}`,
    });
  } else {
    buttons.push({
      type: 2,
      style: 1,
      label: "Claim",
      custom_id: `ticket:claim:${submissionId}`,
    });
  }
  buttons.push({
    type: 2,
    style: 3,
    label: "Resolve",
    custom_id: `ticket:resolve:${submissionId}`,
  });
  buttons.push({
    type: 2,
    style: 4,
    label: "Close",
    custom_id: `ticket:close:${submissionId}`,
  });

  return [{ type: 1, components: buttons }];
}

// Discord brand colors per ticket state. Chosen so the same embed color
// vocabulary (blue = new, green = done, red = bad) matches the review
// flow even though the meaning is slightly different.
const TICKET_COLOR_OPEN = 0x5865f2;
const TICKET_COLOR_IN_PROGRESS = 0xfaa61a;
const TICKET_COLOR_RESOLVED = 0x3ba55d;
const TICKET_COLOR_CLOSED = 0x747f8d;

// Build the footer string for a ticket embed. Keeps the assignee name
// visible even once the ticket is closed so the audit trail is obvious
// in channel. Intentionally terse so it fits the 2048-char footer limit
// even with a very long display name.
function buildTicketFooter(context: RouteContext): {
  text: string;
  color: number;
} {
  const { submission } = context;
  const status = (submission.ticketStatus ?? "open") as TicketLifecycleStatus;
  const assignee = submission.assignedToUserName?.trim();

  if (status === "closed") {
    return { text: "Ticket closed", color: TICKET_COLOR_CLOSED };
  }
  if (status === "resolved") {
    return {
      text: assignee ? `Resolved by ${assignee}` : "Resolved",
      color: TICKET_COLOR_RESOLVED,
    };
  }
  if (status === "in_progress") {
    return {
      text: assignee ? `In progress - ${assignee}` : "In progress",
      color: TICKET_COLOR_IN_PROGRESS,
    };
  }
  return { text: "Open - unassigned", color: TICKET_COLOR_OPEN };
}

// Produce a forum thread title. `titleSource === "field"` copies the raw
// answer; otherwise we interpolate `{fieldId}` tokens inside the template.
// Falls back to the form title if either path comes up empty so the thread
// always has something human-readable.
function resolveForumTitle(context: RouteContext): string {
  const { submission, form } = context;

  if (form.titleSource === "field" && form.titleFieldId) {
    const value = submission.values[form.titleFieldId];
    if (value && value.trim()) {
      return value.trim();
    }
  }

  if (form.titleTemplate) {
    const interpolated = form.titleTemplate.replace(
      /\{([a-z0-9_]+)\}/gi,
      (_, key: string) => {
        const value = submission.values[key];
        return value && value.trim() ? value.trim() : "";
      },
    );
    if (interpolated.trim()) {
      return interpolated.trim();
    }
  }

  return form.title;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// Field types that are private by default and stripped from published
// destination embeds. The form editor picker advertises email as
// "private by default"; this is the single source of truth that enforces
// it on the Discord side. Add new types here to keep them out of public
// channels without touching every call site.
function isPrivateFieldType(type: string): boolean {
  return type === "email";
}

// Per-type rendering for embed field values. Option-based fields show the
// option label (prettier than the internal id), code fields render inside
// a triple-backtick fence so Discord shows its native Copy icon, and text
// fields fall through the existing markdown escape.
function formatFieldValue(
  field: RouteContext["form"]["fields"][number],
  raw: string,
): string {
  if (!raw || raw.length === 0) {
    return "*(empty)*";
  }

  if (field.type === "select" || field.type === "yes_no" || field.type === "checkbox") {
    const match = field.options?.find((option) => option.id === raw);
    const label = match ? match.label : raw;
    return truncate(escapeMarkdown(label), 1024);
  }

  if (field.type === "code") {
    // Close any existing triple-fence so the submitter cannot escape the
    // code block. 3 backticks -> zero-width-joined backticks so the
    // visual appearance is preserved without breaking the fence.
    const safe = raw.replace(/```/g, "``\u200b`");
    const budget = 1024 - 8;
    const body = safe.length > budget ? `${safe.slice(0, budget - 1)}…` : safe;
    return `\`\`\`\n${body}\n\`\`\``;
  }

  if (field.type === "number") {
    // `raw` was normalized to `String(parsedNumber)` on insert, so
    // Number(raw) is safe. We format with thousands grouping and append
    // the free-form currency/unit label the admin configured.
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return truncate(escapeMarkdown(raw), 1024);
    }
    const formatted = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 20,
    }).format(parsed);
    const unit = field.currencyUnit?.trim();
    return unit ? `${formatted} ${unit}` : formatted;
  }

  return truncate(escapeMarkdown(raw), 1024);
}

// Minimal Discord markdown escape. Enough to keep user-supplied strings
// from opening italics or code blocks in DM content.
function escapeMarkdown(value: string): string {
  return value.replace(/([*_`~|\\])/g, "\\$1");
}

// Scheduled from `submissions.applyTicketAction` on every ticket state
// transition. Rewrites the published embed footer and action row so
// Discord reflects the current status and assignee. Uses the thread id
// as the channel id for forum destinations because Discord treats
// threads as channels for message edits.
export const updatePublishedTicketMessage = internalAction({
  args: {
    submissionId: v.id("submissions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await fetchRouteContext(ctx, args.submissionId);
    if (!context) return null;
    const { submission, form, guild } = context;
    if (!form.ticketMode) return null;
    if (!submission.publishedMessageId) return null;

    // Forum threads: edit the starter via the thread id. Text channels:
    // edit via the destination channel id. Missing destination means the
    // form lost its config after the ticket was published; skip cleanly.
    const editChannelId =
      submission.publishedThreadId ?? form.destinationChannelId;
    if (!editChannelId) return null;

    const embed = buildSubmissionEmbed(
      context,
      submission.status === "denied" ? "denied" : "approved",
      "destination",
    );
    const footer = buildTicketFooter(context);
    embed.footer = { text: truncate(footer.text, 2048) };
    embed.color = footer.color;

    const components =
      buildTicketComponents(
        submission._id,
        (submission.ticketStatus ?? "open") as TicketLifecycleStatus,
        Boolean(submission.assignedToUserId),
      ) ?? [];

    const res = await fetch(
      `${DISCORD_API_BASE}/channels/${editChannelId}/messages/${submission.publishedMessageId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${guild.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ embeds: [embed], components }),
      },
    );
    if (!res.ok) {
      await ctx.runMutation(internal.submissions.logRoutingSkip, {
        submissionId: submission._id,
        reason: "ticket_update_failed",
        detail: `${res.status}`,
      });
    }
    return null;
  },
});

// Scheduled from `applyTicketAction` on `close`/`auto_close` (archive)
// and `reopen` (unarchive). Only meaningful for forum destinations;
// text-channel tickets have no thread to toggle so the call is a no-op.
// We PATCH the thread object with `archived` and, when archiving, `locked`
// so further replies are blocked until the ticket is reopened.
export const archiveForumThread = internalAction({
  args: {
    submissionId: v.id("submissions"),
    archived: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await fetchRouteContext(ctx, args.submissionId);
    if (!context) return null;
    const { submission, form, guild } = context;
    if (form.destinationType !== "forum") return null;
    if (!submission.publishedThreadId) return null;

    const res = await fetch(
      `${DISCORD_API_BASE}/channels/${submission.publishedThreadId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${guild.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          archived: args.archived,
          locked: args.archived,
        }),
      },
    );
    if (!res.ok) {
      await ctx.runMutation(internal.submissions.logRoutingSkip, {
        submissionId: submission._id,
        reason: args.archived
          ? "ticket_archive_failed"
          : "ticket_unarchive_failed",
        detail: `${res.status}`,
      });
    }
    return null;
  },
});

// Scheduled from `submissions.postReply` (dashboard reply flow). Posts
// a plain Discord message authored by the moderator into the same
// channel/thread as the published submission. Uses `message_reference`
// on text destinations so the reply threads under the original post;
// forum destinations already live inside a thread so we post directly.
// `allowed_mentions.parse = []` keeps the message silent.
export const postReplyToSubmission = internalAction({
  args: {
    submissionId: v.id("submissions"),
    authorName: v.string(),
    body: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await fetchRouteContext(ctx, args.submissionId);
    if (!context) return null;
    const { submission, form, guild } = context;

    const authorLine = `**${escapeMarkdown(args.authorName)}** (via dashboard)`;
    const bodyText = truncate(args.body, 1800);
    const content = `${authorLine}\n${bodyText}`;

    const payload: Record<string, unknown> = {
      content,
      allowed_mentions: { parse: [] as Array<never> },
    };

    let targetChannelId: string | undefined;
    if (form.destinationType === "forum") {
      targetChannelId = submission.publishedThreadId;
    } else if (form.destinationType === "text") {
      targetChannelId = form.destinationChannelId;
      if (submission.publishedMessageId && targetChannelId) {
        payload.message_reference = {
          channel_id: targetChannelId,
          message_id: submission.publishedMessageId,
          fail_if_not_exists: false,
        };
      }
    }

    if (!targetChannelId) {
      await ctx.runMutation(internal.submissions.logRoutingSkip, {
        submissionId: submission._id,
        reason: "reply_skipped_target_missing",
      });
      return null;
    }

    const res = await fetch(
      `${DISCORD_API_BASE}/channels/${targetChannelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${guild.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      await ctx.runMutation(internal.submissions.logRoutingSkip, {
        submissionId: submission._id,
        reason: "reply_post_failed",
        detail: `${res.status}`,
      });
    }
    return null;
  },
});

// Scheduled from `submissions.deleteSubmission` when the admin opts in to
// Discord cleanup. Runs after the Convex row is gone so it takes the
// message ids as args rather than re-reading the submission. Swallows 404
// (message already deleted) and any other non-2xx by writing an audit row.
// We pass `guildId` explicitly so we can still look up the bot token.
export const deleteDiscordMessages = internalAction({
  args: {
    guildId: v.id("guilds"),
    targets: v.array(
      v.object({
        channelId: v.string(),
        messageId: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const guild = await ctx.runQuery(internal.guilds.getBotTokenForDelete, {
      guildId: args.guildId,
    });
    if (!guild) return null;

    // Collect failures inline so we can write them in a single audit
    // mutation at the end instead of one round trip per target.
    const skips: Array<string> = [];
    for (const target of args.targets) {
      const res = await fetch(
        `${DISCORD_API_BASE}/channels/${target.channelId}/messages/${target.messageId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bot ${guild.botToken}`,
          },
        },
      );
      if (!res.ok && res.status !== 404) {
        skips.push(`${target.channelId}/${target.messageId}:${res.status}`);
      }
    }
    if (skips.length > 0) {
      await ctx.runMutation(internal.guilds.logDiscordDeleteSkip, {
        guildId: args.guildId,
        details: skips,
      });
    }
    return null;
  },
});
