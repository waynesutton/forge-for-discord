import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Forge core schema. Identity tables live inside the @robelest/convex-auth
// component (`components.auth`); the `users` table here mirrors profile data
// for app-level queries keyed by the auth subject.
export default defineSchema({
  users: defineTable({
    subject: v.string(),
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("owner")),
  }).index("by_subject", ["subject"]),

  guilds: defineTable({
    discordGuildId: v.string(),
    name: v.string(),
    iconUrl: v.optional(v.string()),
    botToken: v.string(),
    publicKey: v.string(),
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
  })
    .index("by_discordguildid", ["discordGuildId"])
    .index("by_installedbyuserid", ["installedByUserId"]),

  guildChannels: defineTable({
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
  })
    .index("by_guildid_and_position", ["guildId", "position"])
    .index("by_guildid_and_discordchannelid", ["guildId", "discordChannelId"]),

  guildRoles: defineTable({
    guildId: v.id("guilds"),
    discordRoleId: v.string(),
    name: v.string(),
    position: v.number(),
    color: v.optional(v.number()),
    managed: v.boolean(),
  })
    .index("by_guildid_and_position", ["guildId", "position"])
    .index("by_guildid_and_discordroleid", ["guildId", "discordRoleId"]),

  // Single compound index on [guildId, commandName] also serves queries
  // that only constrain by guildId, so no separate by_guildId index.
  forms: defineTable({
    guildId: v.id("guilds"),
    commandName: v.string(),
    commandDescription: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    fields: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        type: v.union(
          v.literal("short"),
          v.literal("paragraph"),
          v.literal("email"),
          v.literal("code"),
          v.literal("select"),
          v.literal("yes_no"),
          v.literal("checkbox"),
          v.literal("number"),
        ),
        required: v.boolean(),
        placeholder: v.optional(v.string()),
        helperText: v.optional(v.string()),
        minLength: v.optional(v.number()),
        maxLength: v.optional(v.number()),
        // Number field knobs. `minValue` and `maxValue` bound the parsed
        // number. `currencyUnit` is a free-form label appended on render
        // (e.g. "USD", "credits", "sats"); we never treat it as money.
        minValue: v.optional(v.number()),
        maxValue: v.optional(v.number()),
        currencyUnit: v.optional(v.string()),
        // Options used by select / yes_no / checkbox. For yes_no the editor
        // always sets this to [{id:"yes", label:"Yes"}, {id:"no", label:"No"}]
        // so the modal submit value maps directly to the option id.
        options: v.optional(
          v.array(
            v.object({
              id: v.string(),
              label: v.string(),
            }),
          ),
        ),
      }),
    ),
    requiresApproval: v.boolean(),
    modQueueChannelId: v.optional(v.string()),
    destinationChannelId: v.optional(v.string()),
    destinationType: v.optional(v.union(v.literal("text"), v.literal("forum"))),
    forumTagId: v.optional(v.string()),
    titleSource: v.union(v.literal("static"), v.literal("field")),
    titleTemplate: v.optional(v.string()),
    titleFieldId: v.optional(v.string()),
    requiredRoleIds: v.optional(v.array(v.string())),
    restrictedRoleIds: v.optional(v.array(v.string())),
    modRoleIds: v.optional(v.array(v.string())),
    cooldownSeconds: v.optional(v.number()),
    successMessage: v.optional(v.string()),
    maxSubmissionsPerUser: v.optional(v.number()),
    maxSubmissionsPerDay: v.optional(v.number()),
    // When false, the published embed footer reads "Approved" / "Denied"
    // without the moderator name. Undefined defaults to true so existing
    // forms keep showing the name.
    showModeratorInFooter: v.optional(v.boolean()),
    // When true (default when undefined), published messages prepend
    // "Submitted by <@submitterId>" so anyone in the channel can click
    // through to the submitter's Discord profile. Mentions are sent with
    // `allowed_mentions.parse = []` so no one gets pinged.
    linkSubmitterOnPublish: v.optional(v.boolean()),
    // Opt-in ticket lifecycle. When true, published messages carry
    // Claim / Resolve / Reopen / Close buttons, submissions track
    // assignment and `ticketStatus`, and the cron sweeps stale tickets.
    // Undefined / false keeps today's one-shot intake behavior.
    ticketMode: v.optional(v.boolean()),
    // Days of inactivity before the cron auto-closes a ticket. Only
    // honored when `ticketMode` is on. Undefined or 0 disables auto close.
    autoCloseInactiveDays: v.optional(v.number()),
    // Extra Discord role ids that can press Claim / Resolve beyond the
    // built-in admin + mod gate. Empty or undefined means only admins and
    // `modRoleIds` can press those buttons. The submitter can always press
    // Resolve and Close on their own ticket; that rule lives in `http.ts`.
    ticketClaimRoleIds: v.optional(v.array(v.string())),
    ticketResolveRoleIds: v.optional(v.array(v.string())),
    published: v.boolean(),
    discordCommandId: v.optional(v.string()),
  }).index("by_guildid_and_commandname", ["guildId", "commandName"]),

  // The wide compound index [formId, submitterId, submittedAt] serves all
  // three prefix queries (formId only; formId+submitterId; full triple).
  // Per-guild queries use `by_guildId_and_submitterId` (prefix covers
  // guildId-only lookups) or `by_guildId_and_status` (for the mod queue).
  submissions: defineTable({
    guildId: v.id("guilds"),
    formId: v.id("forms"),
    submitterId: v.string(),
    submitterName: v.string(),
    submittedAt: v.optional(v.number()),
    values: v.record(v.string(), v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("auto_published"),
    ),
    modQueueMessageId: v.optional(v.string()),
    modQueueChannelId: v.optional(v.string()),
    publishedMessageId: v.optional(v.string()),
    publishedThreadId: v.optional(v.string()),
    decidedBy: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    denyReason: v.optional(v.string()),
    // Soft-hide flag used by the dashboard. Never read by cap enforcement
    // (hidden rows still count). Discord-side messages are untouched.
    hiddenAt: v.optional(v.number()),
    // Ticket lifecycle columns. Only set when the submission's form has
    // `ticketMode` on. Approval `status` stays independent; ticketStatus
    // tracks what happens to the ticket after publish.
    ticketStatus: v.optional(
      v.union(
        v.literal("open"),
        v.literal("in_progress"),
        v.literal("resolved"),
        v.literal("closed"),
      ),
    ),
    assignedToUserId: v.optional(v.string()),
    assignedToUserName: v.optional(v.string())
,
    assignedAt: v.optional(v.number()),
    // Seeded from submittedAt on insert, bumped by every mod action
    // (claim, reassign, resolve, reopen, close, dashboard reply,
    // approve, deny). Drives the auto-close cron sweep.
    lastActivityAt: v.optional(v.number()),
  })
    .index("by_formid_and_submitterid_and_submittedat", [
      "formId",
      "submitterId",
      "submittedAt",
    ])
    .index("by_guildid_and_submitterid", ["guildId", "submitterId"])
    .index("by_guildid_and_status", ["guildId", "status"])
    .index("by_ticketstatus_and_lastactivityat", [
      "ticketStatus",
      "lastActivityAt",
    ]),

  auditLog: defineTable({
    guildId: v.id("guilds"),
    actorId: v.string(),
    action: v.string(),
    submissionId: v.optional(v.id("submissions")),
    formId: v.optional(v.id("forms")),
    metadata: v.optional(v.any()),
  })
    .index("by_guildid", ["guildId"])
    .index("by_submissionid", ["submissionId"])
    .index("by_formid", ["formId"]),

  cooldowns: defineTable({
    formId: v.id("forms"),
    submitterId: v.string(),
    lastSubmittedAt: v.number(),
  }).index("by_formid_and_submitterid", ["formId", "submitterId"]),

  // Short-lived CSRF nonces for the Discord bot install flow. The dashboard
  // mints a row via `generateDiscordInstallUrl`, embeds the `state` nonce in
  // the authorize URL, and the `/api/discord/install` HTTP action consumes
  // the row to prove the redirect came from a real signed-in admin. Rows
  // auto-expire via `gcExpired`; keep the table narrow so cleanup is cheap.
  oauthStates: defineTable({
    state: v.string(),
    userId: v.id("users"),
    kind: v.literal("discord_install"),
    expiresAt: v.number(),
    // Origin the admin was on when they minted the nonce (e.g.
    // "https://usable-kiwi-349.convex.site" or "http://localhost:5173").
    // The Discord install HTTP callback uses this to 302 back to the same
    // origin instead of trusting `APP_URL`, which can drift between
    // deployments and strand users on the wrong domain.
    returnOrigin: v.optional(v.string()),
  })
    .index("by_state", ["state"])
    .index("by_expiresat", ["expiresAt"])
    .index("by_userid", ["userId"]),
});
