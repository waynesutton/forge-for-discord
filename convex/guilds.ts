// Guild registry. One Discord server == one row. V1 is single-guild (the PRD
// open question #1 deferred multi-guild), but the schema already carries
// `by_discord_id` so going multi later is just UI + routing work.
//
// Bot credentials (`botToken`, `publicKey`, `applicationId`) come from Convex
// env vars at install time and are copied into the row. Per-guild credentials
// would be needed for a multi-bot SaaS; single-bot self-host just snapshots
// the currently-configured bot into the guild row.
//
// Identity policy: every function here reads email via `auth.user.viewer(ctx)`
// because Robel JWTs only carry `sub`. Only `@convex.dev` users pass the gate.
// `wayne@convex.dev` is `owner`; everyone else is `admin`; both can install
// a guild in v1. Role restrictions tighten in Phase 5.

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { optionalAllowedViewer, requireAllowedViewer } from "./lib/auth";

// Listing API used by /app/settings. Returns all guilds installed into this
// Forge deployment ordered by creation. Fields sent down the wire omit
// `botToken` because it's a secret and the client never needs it.
const publicGuildValidator = v.object({
  _id: v.id("guilds"),
  _creationTime: v.number(),
  discordGuildId: v.string(),
  name: v.string(),
  iconUrl: v.optional(v.string()),
  applicationId: v.string(),
  installedByUserId: v.id("users"),
  defaultModQueueChannelId: v.optional(v.string()),
  defaultDestinationChannelId: v.optional(v.string()),
  defaultDestinationType: v.optional(
    v.union(v.literal("text"), v.literal("forum")),
  ),
  defaultForumTagId: v.optional(v.string()),
  lastChannelsSyncAt: v.optional(v.number()),
  lastRolesSyncAt: v.optional(v.number()),
});

const publicChannelValidator = v.object({
  _id: v.id("guildChannels"),
  _creationTime: v.number(),
  guildId: v.id("guilds"),
  discordChannelId: v.string(),
  name: v.string(),
  type: v.union(v.literal("text"), v.literal("forum"), v.literal("category")),
  parentId: v.optional(v.string()),
  parentName: v.optional(v.string()),
  position: v.number(),
  availableTags: v.optional(
    v.array(
      v.object({
        id: v.string(),
        name: v.string(),
      }),
    ),
  ),
});

const publicRoleValidator = v.object({
  _id: v.id("guildRoles"),
  _creationTime: v.number(),
  guildId: v.id("guilds"),
  discordRoleId: v.string(),
  name: v.string(),
  position: v.number(),
  color: v.optional(v.number()),
  managed: v.boolean(),
});

// v1 cap: 100 guilds per Forge deployment. That is well above realistic usage
// for a self-hosted instance and keeps the query firmly under the Convex
// documents-read limit. `.take(100)` silences the ESLint warning without
// inviting a future surprise migration.
export const list = query({
  args: {},
  returns: v.array(publicGuildValidator),
  handler: async (ctx) => {
    const me = await requireAllowedUser(ctx);
    if (!me) return [];
    const rows = await ctx.db.query("guilds").order("asc").take(100);
    return rows.map(stripSecrets);
  },
});

// Convenience query used by the dashboard "connected guild" banner in v1.
// Returns the most recently installed guild, or null if none are connected.
// When v2 adds a guild switcher this gets replaced by a user-preference lookup.
export const current = query({
  args: {},
  returns: v.union(v.null(), publicGuildValidator),
  handler: async (ctx) => {
    const me = await requireAllowedUser(ctx);
    if (!me) return null;
    const row = await ctx.db.query("guilds").order("desc").take(1);
    return row[0] ? stripSecrets(row[0]) : null;
  },
});

export const listChannels = query({
  args: { guildId: v.id("guilds") },
  returns: v.array(publicChannelValidator),
  handler: async (ctx, args) => {
    const me = await requireAllowedUser(ctx);
    if (!me) return [];

    const rows = await ctx.db
      .query("guildChannels")
      .withIndex("by_guildid_and_position", (q) => q.eq("guildId", args.guildId))
      .take(500);

    return rows.map((row) => ({
      _id: row._id,
      _creationTime: row._creationTime,
      guildId: row.guildId,
      discordChannelId: row.discordChannelId,
      name: row.name,
      type: row.type,
      parentId: row.parentId,
      parentName: row.parentName,
      position: row.position,
      availableTags: row.availableTags,
    }));
  },
});

export const listRoles = query({
  args: { guildId: v.id("guilds") },
  returns: v.array(publicRoleValidator),
  handler: async (ctx, args) => {
    const me = await requireAllowedUser(ctx);
    if (!me) return [];

    const rows = await ctx.db
      .query("guildRoles")
      .withIndex("by_guildid_and_position", (q) => q.eq("guildId", args.guildId))
      .take(500);

    return rows.map((row) => ({
      _id: row._id,
      _creationTime: row._creationTime,
      guildId: row.guildId,
      discordRoleId: row.discordRoleId,
      name: row.name,
      position: row.position,
      color: row.color,
      managed: row.managed,
    }));
  },
});

export const updateRoutingDefaults = mutation({
  args: {
    guildId: v.id("guilds"),
    defaultModQueueChannelId: v.optional(v.string()),
    defaultDestinationChannelId: v.optional(v.string()),
    defaultDestinationType: v.optional(
      v.union(v.literal("text"), v.literal("forum")),
    ),
    defaultForumTagId: v.optional(v.string()),
  },
  returns: publicGuildValidator,
  handler: async (ctx, args) => {
    await requireAllowedWorkspaceUser(ctx);

    const guild = await ctx.db.get("guilds", args.guildId);
    if (!guild) {
      throw new ConvexError({ code: "guild_not_found" });
    }

    const channels = await ctx.db
      .query("guildChannels")
      .withIndex("by_guildid_and_position", (q) => q.eq("guildId", guild._id))
      .take(500);
    const channelById = new Map(
      channels.map((channel) => [channel.discordChannelId, channel]),
    );

    validateTextChannel(
      channelById,
      args.defaultModQueueChannelId,
      "default_mod_queue_channel_invalid",
    );
    validateDestinationSelection(
      channelById,
      args.defaultDestinationChannelId,
      args.defaultDestinationType,
      args.defaultForumTagId,
    );

    await ctx.db.patch("guilds", guild._id, {
      defaultModQueueChannelId: args.defaultModQueueChannelId,
      defaultDestinationChannelId: args.defaultDestinationChannelId,
      defaultDestinationType: args.defaultDestinationType,
      defaultForumTagId: args.defaultForumTagId,
    });

    const updated = await ctx.db.get("guilds", guild._id);
    if (!updated) {
      throw new ConvexError({ code: "guild_not_found" });
    }

    return stripSecrets(updated);
  },
});

// Admin-facing disconnect path for `/app/settings`. Removes the guild row plus
// all guild-scoped data that would otherwise point at a dead guild id.
export const disconnect = mutation({
  args: { guildId: v.id("guilds") },
  returns: v.object({
    guildId: v.id("guilds"),
    deletedForms: v.number(),
    deletedSubmissions: v.number(),
    deletedAuditLog: v.number(),
    deletedCooldowns: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAllowedWorkspaceUser(ctx);

    const guild = await ctx.db.get("guilds", args.guildId);
    if (!guild) {
      throw new ConvexError({ code: "guild_not_found" });
    }

    const deletedSubmissions = await deleteGuildSubmissions(ctx, guild._id);
    const deletedAuditLog = await deleteGuildAuditLog(ctx, guild._id);
    const { deletedForms, deletedCooldowns } = await deleteGuildForms(
      ctx,
      guild._id,
    );
    await deleteGuildChannels(ctx, guild._id);
    await deleteGuildRoles(ctx, guild._id);

    await ctx.db.delete("guilds", guild._id);

    return {
      guildId: guild._id,
      deletedForms,
      deletedSubmissions,
      deletedAuditLog,
      deletedCooldowns,
    };
  },
});

// Called by the Discord install HTTP action after it exchanges the OAuth code
// for a bot token + guild metadata. Idempotent by `discordGuildId`: reinstalls
// from Discord overwrite the row rather than inserting a duplicate (Discord
// re-issues the same guild in the redirect). Returns the guild Convex ID so
// the HTTP action can include it in the success redirect querystring.
export const registerFromInstall = internalMutation({
  args: {
    userId: v.id("users"),
    discordGuildId: v.string(),
    name: v.string(),
    iconUrl: v.optional(v.string()),
    botToken: v.string(),
    publicKey: v.string(),
    applicationId: v.string(),
  },
  returns: v.id("guilds"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("guilds")
      .withIndex("by_discordguildid", (q) =>
        q.eq("discordGuildId", args.discordGuildId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch("guilds", existing._id, {
        name: args.name,
        iconUrl: args.iconUrl,
        botToken: args.botToken,
        publicKey: args.publicKey,
        applicationId: args.applicationId,
        installedByUserId: args.userId,
        defaultModQueueChannelId: existing.defaultModQueueChannelId,
        defaultDestinationChannelId: existing.defaultDestinationChannelId,
        defaultDestinationType: existing.defaultDestinationType,
        defaultForumTagId: existing.defaultForumTagId,
        lastChannelsSyncAt: existing.lastChannelsSyncAt,
        lastRolesSyncAt: existing.lastRolesSyncAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("guilds", {
      discordGuildId: args.discordGuildId,
      name: args.name,
      iconUrl: args.iconUrl,
      botToken: args.botToken,
      publicKey: args.publicKey,
      applicationId: args.applicationId,
      installedByUserId: args.userId,
      defaultModQueueChannelId: undefined,
      defaultDestinationChannelId: undefined,
      defaultDestinationType: undefined,
      defaultForumTagId: undefined,
      lastChannelsSyncAt: undefined,
      lastRolesSyncAt: undefined,
    });
  },
});

export const getInstallForChannelSync = internalQuery({
  args: { guildId: v.id("guilds") },
  returns: v.union(
    v.null(),
    v.object({
      guildId: v.id("guilds"),
      discordGuildId: v.string(),
      botToken: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const guild = await ctx.db.get("guilds", args.guildId);
    if (!guild) {
      return null;
    }

    return {
      guildId: guild._id,
      discordGuildId: guild.discordGuildId,
      botToken: guild.botToken,
    };
  },
});

export const getInstallForRoleSync = internalQuery({
  args: { guildId: v.id("guilds") },
  returns: v.union(
    v.null(),
    v.object({
      guildId: v.id("guilds"),
      discordGuildId: v.string(),
      botToken: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const guild = await ctx.db.get("guilds", args.guildId);
    if (!guild) {
      return null;
    }

    return {
      guildId: guild._id,
      discordGuildId: guild.discordGuildId,
      botToken: guild.botToken,
    };
  },
});

// Narrow accessor used by the scheduled Discord cleanup action. Returns
// only the bot token so the action does not see unrelated guild fields.
export const getBotTokenForDelete = internalQuery({
  args: { guildId: v.id("guilds") },
  returns: v.union(v.null(), v.object({ botToken: v.string() })),
  handler: async (ctx, args) => {
    const guild = await ctx.db.get("guilds", args.guildId);
    if (!guild) return null;
    return { botToken: guild.botToken };
  },
});

// Best-effort audit writer for skipped Discord deletions. Kept in
// `guilds.ts` because it does not need a submission row (the row is gone
// by the time this runs) and belongs to the guild-level history. Accepts
// a batch of details so the caller can loop over Discord API failures
// locally and flush in one transaction.
export const logDiscordDeleteSkip = internalMutation({
  args: {
    guildId: v.id("guilds"),
    details: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const detail of args.details) {
      await ctx.db.insert("auditLog", {
        guildId: args.guildId,
        actorId: "system",
        action: "discord_delete_skip",
        metadata: { detail },
      });
    }
    return null;
  },
});

export const replaceChannelsCache = internalMutation({
  args: {
    guildId: v.id("guilds"),
    channels: v.array(
      v.object({
        discordChannelId: v.string(),
        name: v.string(),
        type: v.union(v.literal("text"), v.literal("forum"), v.literal("category")),
        parentId: v.optional(v.string()),
        parentName: v.optional(v.string()),
        position: v.number(),
        availableTags: v.optional(
          v.array(
            v.object({
              id: v.string(),
              name: v.string(),
            }),
          ),
        ),
      }),
    ),
    syncedAt: v.number(),
  },
  returns: v.object({ count: v.number(), syncedAt: v.number() }),
  handler: async (ctx, args) => {
    while (true) {
      const batch = await ctx.db
        .query("guildChannels")
        .withIndex("by_guildid_and_position", (q) => q.eq("guildId", args.guildId))
        .take(500);
      if (batch.length === 0) {
        break;
      }

      for (const row of batch) {
        await ctx.db.delete("guildChannels", row._id);
      }
    }

    for (const channel of args.channels) {
      await ctx.db.insert("guildChannels", {
        guildId: args.guildId,
        discordChannelId: channel.discordChannelId,
        name: channel.name,
        type: channel.type,
        parentId: channel.parentId,
        parentName: channel.parentName,
        position: channel.position,
        availableTags: channel.availableTags,
      });
    }

    await ctx.db.patch("guilds", args.guildId, {
      lastChannelsSyncAt: args.syncedAt,
    });

    return { count: args.channels.length, syncedAt: args.syncedAt };
  },
});

export const replaceRolesCache = internalMutation({
  args: {
    guildId: v.id("guilds"),
    roles: v.array(
      v.object({
        discordRoleId: v.string(),
        name: v.string(),
        position: v.number(),
        color: v.optional(v.number()),
        managed: v.boolean(),
      }),
    ),
    syncedAt: v.number(),
  },
  returns: v.object({ count: v.number(), syncedAt: v.number() }),
  handler: async (ctx, args) => {
    while (true) {
      const batch = await ctx.db
        .query("guildRoles")
        .withIndex("by_guildid_and_position", (q) => q.eq("guildId", args.guildId))
        .take(500);
      if (batch.length === 0) {
        break;
      }

      for (const row of batch) {
        await ctx.db.delete("guildRoles", row._id);
      }
    }

    for (const role of args.roles) {
      await ctx.db.insert("guildRoles", {
        guildId: args.guildId,
        discordRoleId: role.discordRoleId,
        name: role.name,
        position: role.position,
        color: role.color,
        managed: role.managed,
      });
    }

    await ctx.db.patch("guilds", args.guildId, {
      lastRolesSyncAt: args.syncedAt,
    });

    return { count: args.roles.length, syncedAt: args.syncedAt };
  },
});

// -- helpers --------------------------------------------------------------

async function requireAllowedUser(ctx: QueryCtx | MutationCtx) {
  return await optionalAllowedViewer(ctx);
}

async function requireAllowedWorkspaceUser(ctx: MutationCtx) {
  await requireAllowedViewer(ctx);

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "unauthenticated" });
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_subject", (q) => q.eq("subject", identity.subject))
    .unique();
  if (!user) {
    throw new ConvexError({ code: "unknown_user" });
  }

  return user;
}

async function deleteGuildSubmissions(
  ctx: MutationCtx,
  guildId: Id<"guilds">,
): Promise<number> {
  let deleted = 0;

  while (true) {
    const batch = await ctx.db
      .query("submissions")
      .withIndex("by_guildid_and_submitterid", (q) => q.eq("guildId", guildId))
      .take(100);
    if (batch.length === 0) {
      return deleted;
    }

    for (const row of batch) {
      await ctx.db.delete("submissions", row._id);
      deleted += 1;
    }
  }
}

async function deleteGuildAuditLog(
  ctx: MutationCtx,
  guildId: Id<"guilds">,
): Promise<number> {
  let deleted = 0;

  while (true) {
    const batch = await ctx.db
      .query("auditLog")
      .withIndex("by_guildid", (q) => q.eq("guildId", guildId))
      .take(100);
    if (batch.length === 0) {
      return deleted;
    }

    for (const row of batch) {
      await ctx.db.delete("auditLog", row._id);
      deleted += 1;
    }
  }
}

async function deleteGuildForms(
  ctx: MutationCtx,
  guildId: Id<"guilds">,
): Promise<{ deletedForms: number; deletedCooldowns: number }> {
  let deletedForms = 0;
  let deletedCooldowns = 0;

  while (true) {
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_guildid_and_commandname", (q) => q.eq("guildId", guildId))
      .take(100);
    if (forms.length === 0) {
      return { deletedForms, deletedCooldowns };
    }

    for (const form of forms) {
      deletedCooldowns += await deleteFormCooldowns(ctx, form._id);
      await ctx.db.delete("forms", form._id);
      deletedForms += 1;
    }
  }
}

async function deleteGuildChannels(ctx: MutationCtx, guildId: Id<"guilds">) {
  while (true) {
    const batch = await ctx.db
      .query("guildChannels")
      .withIndex("by_guildid_and_position", (q) => q.eq("guildId", guildId))
      .take(500);
    if (batch.length === 0) {
      return;
    }

    for (const row of batch) {
      await ctx.db.delete("guildChannels", row._id);
    }
  }
}

async function deleteGuildRoles(ctx: MutationCtx, guildId: Id<"guilds">) {
  while (true) {
    const batch = await ctx.db
      .query("guildRoles")
      .withIndex("by_guildid_and_position", (q) => q.eq("guildId", guildId))
      .take(500);
    if (batch.length === 0) {
      return;
    }

    for (const row of batch) {
      await ctx.db.delete("guildRoles", row._id);
    }
  }
}

async function deleteFormCooldowns(
  ctx: MutationCtx,
  formId: Id<"forms">,
): Promise<number> {
  let deleted = 0;

  while (true) {
    const batch = await ctx.db
      .query("cooldowns")
      .withIndex("by_formid_and_submitterid", (q) => q.eq("formId", formId))
      .take(100);
    if (batch.length === 0) {
      return deleted;
    }

    for (const row of batch) {
      await ctx.db.delete("cooldowns", row._id);
      deleted += 1;
    }
  }
}

function stripSecrets(row: Doc<"guilds">) {
  return {
    _id: row._id,
    _creationTime: row._creationTime,
    discordGuildId: row.discordGuildId,
    name: row.name,
    iconUrl: row.iconUrl,
    applicationId: row.applicationId,
    installedByUserId: row.installedByUserId,
    defaultModQueueChannelId: row.defaultModQueueChannelId,
    defaultDestinationChannelId: row.defaultDestinationChannelId,
    defaultDestinationType: row.defaultDestinationType,
    defaultForumTagId: row.defaultForumTagId,
    lastChannelsSyncAt: row.lastChannelsSyncAt,
    lastRolesSyncAt: row.lastRolesSyncAt,
  } satisfies {
    _id: Id<"guilds">;
    _creationTime: number;
    discordGuildId: string;
    name: string;
    iconUrl?: string;
    applicationId: string;
    installedByUserId: Id<"users">;
    defaultModQueueChannelId?: string;
    defaultDestinationChannelId?: string;
    defaultDestinationType?: "text" | "forum";
    defaultForumTagId?: string;
    lastChannelsSyncAt?: number;
    lastRolesSyncAt?: number;
  };
}

function validateTextChannel(
  channelById: Map<string, Doc<"guildChannels">>,
  channelId: string | undefined,
  code: string,
) {
  if (!channelId) {
    return;
  }

  const channel = channelById.get(channelId);
  if (!channel || channel.type !== "text") {
    throw new ConvexError({ code });
  }
}

function validateDestinationSelection(
  channelById: Map<string, Doc<"guildChannels">>,
  destinationChannelId: string | undefined,
  destinationType: "text" | "forum" | undefined,
  forumTagId: string | undefined,
) {
  if (!destinationChannelId && !destinationType && !forumTagId) {
    return;
  }

  if (!destinationChannelId || !destinationType) {
    throw new ConvexError({ code: "destination_incomplete" });
  }

  const destination = channelById.get(destinationChannelId);
  if (!destination || destination.type !== destinationType) {
    throw new ConvexError({ code: "destination_channel_invalid" });
  }

  if (destinationType === "forum") {
    if (
      forumTagId &&
      !destination.availableTags?.some((tag) => tag.id === forumTagId)
    ) {
      throw new ConvexError({ code: "forum_tag_invalid" });
    }
    return;
  }

  if (forumTagId) {
    throw new ConvexError({ code: "forum_tag_requires_forum_destination" });
  }
}
