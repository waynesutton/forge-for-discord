import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAllowedViewer } from "./lib/auth";

const submissionSummaryValidator = v.object({
  _id: v.id("submissions"),
  _creationTime: v.number(),
  guildId: v.id("guilds"),
  formId: v.id("forms"),
  submitterId: v.string(),
  submitterName: v.string(),
  submittedAt: v.number(),
  values: v.record(v.string(), v.string()),
  status: v.union(
    v.literal("pending"),
    v.literal("approved"),
    v.literal("denied"),
    v.literal("auto_published"),
  ),
  decidedAt: v.optional(v.number()),
  decidedBy: v.optional(v.string()),
  denyReason: v.optional(v.string()),
  hiddenAt: v.optional(v.number()),
  hasModQueueMessage: v.boolean(),
  hasPublishedMessage: v.boolean(),
  // Ticket-mode fields. Always present in the validator so the React
  // result type is stable; undefined for non-ticket forms so existing
  // UI keeps rendering as before.
  ticketStatus: v.optional(
    v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("closed"),
    ),
  ),
  assignedToUserId: v.optional(v.string()),
  assignedToUserName: v.optional(v.string()),
  assignedAt: v.optional(v.number()),
  lastActivityAt: v.optional(v.number()),
});

export const listForForm = query({
  args: {
    formId: v.id("forms"),
    includeHidden: v.optional(v.boolean()),
  },
  returns: v.array(submissionSummaryValidator),
  handler: async (ctx, args) => {
    await requireAllowedUser(ctx);

    const rows = await ctx.db
      .query("submissions")
      .withIndex("by_formid_and_submitterid_and_submittedat", (q) =>
        q.eq("formId", args.formId),
      )
      .order("desc")
      .take(200);

    const filtered = args.includeHidden
      ? rows
      : rows.filter((row) => row.hiddenAt === undefined);

    return filtered.map((row) => ({
      _id: row._id,
      _creationTime: row._creationTime,
      guildId: row.guildId,
      formId: row.formId,
      submitterId: row.submitterId,
      submitterName: row.submitterName,
      submittedAt: row.submittedAt ?? row._creationTime,
      values: row.values,
      status: row.status,
      decidedAt: row.decidedAt,
      decidedBy: row.decidedBy,
      denyReason: row.denyReason,
      hiddenAt: row.hiddenAt,
      hasModQueueMessage: Boolean(row.modQueueMessageId),
      hasPublishedMessage: Boolean(row.publishedMessageId),
      ticketStatus: row.ticketStatus,
      assignedToUserId: row.assignedToUserId,
      assignedToUserName: row.assignedToUserName,
      assignedAt: row.assignedAt,
      lastActivityAt: row.lastActivityAt,
    }));
  },
});

// Soft hide or restore. Does not touch Discord. Admin-gated because it
// changes what other admins see on the results page.
export const setHidden = mutation({
  args: {
    submissionId: v.id("submissions"),
    hidden: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAllowedUser(ctx);
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) {
      throw new ConvexError({ code: "submission_not_found" });
    }
    await ctx.db.patch("submissions", args.submissionId, {
      hiddenAt: args.hidden ? Date.now() : undefined,
    });
    return null;
  },
});

// Hard delete. Captures Discord message ids up front because the action
// runs after the row is gone. If `deleteFromDiscord` is false (the UI
// default), the Discord messages stay where they are so conversation
// history in the mod queue and destination channel survives.
export const deleteSubmission = mutation({
  args: {
    submissionId: v.id("submissions"),
    deleteFromDiscord: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAllowedUser(ctx);
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) {
      throw new ConvexError({ code: "submission_not_found" });
    }

    if (args.deleteFromDiscord) {
      const targets: Array<{ channelId: string; messageId: string }> = [];
      if (submission.modQueueChannelId && submission.modQueueMessageId) {
        targets.push({
          channelId: submission.modQueueChannelId,
          messageId: submission.modQueueMessageId,
        });
      }
      if (submission.publishedMessageId) {
        // For text destinations the published message id lives in the
        // destination channel. For forum destinations it lives inside the
        // thread whose id matches the starter message id. Passing the
        // thread id as channel handles both cases when present.
        const channelId =
          submission.publishedThreadId ?? submission.modQueueChannelId;
        if (channelId) {
          targets.push({
            channelId,
            messageId: submission.publishedMessageId,
          });
        }
      }

      if (targets.length > 0) {
        await ctx.scheduler.runAfter(0, internal.discord.deleteDiscordMessages, {
          guildId: submission.guildId,
          targets,
        });
      }
    }

    await ctx.db.delete("submissions", args.submissionId);
    return null;
  },
});

// Public approve/deny for dashboard admins. The Discord button path stays the
// primary entry point, but moderators can also decide from the results page.
// Relies on `requireAllowedUser` for the workspace gate (same bar as Hide and
// Delete); Discord-side mod role restrictions only apply to in-channel clicks.
// Delegates the actual transition to `internal.submissions.recordDecision`
// so the audit log and follow-up schedules (publish, DM, mod queue edit) stay
// identical across entry points.
export const decide = mutation({
  args: {
    submissionId: v.id("submissions"),
    decision: v.union(v.literal("approved"), v.literal("denied")),
    denyReason: v.optional(v.string()),
  },
  returns: v.object({
    alreadyDecided: v.boolean(),
    decidedByName: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const viewer = await requireAllowedUser(ctx);

    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) {
      throw new ConvexError({ code: "submission_not_found" });
    }

    if (args.decision === "denied") {
      const trimmed = args.denyReason?.trim();
      if (!trimmed) {
        throw new ConvexError({ code: "deny_reason_required" });
      }
      if (trimmed.length > 500) {
        throw new ConvexError({ code: "deny_reason_too_long" });
      }
    }

    const viewerEmail =
      typeof viewer.email === "string" ? viewer.email : undefined;
    const viewerName =
      typeof viewer.name === "string" && viewer.name.trim().length > 0
        ? viewer.name.trim()
        : (viewerEmail ?? "Dashboard admin");
    const moderatorId =
      viewerEmail ??
      (typeof viewer._id === "string" ? viewer._id : "dashboard");

    return await applyDecision(ctx, {
      submissionId: args.submissionId,
      decision: args.decision,
      moderatorId,
      moderatorName: viewerName,
      denyReason:
        args.decision === "denied" ? args.denyReason?.trim() : undefined,
    });
  },
});

export const insertFromDiscord = internalMutation({
  args: {
    guildId: v.id("guilds"),
    formId: v.id("forms"),
    submitterId: v.string(),
    submitterName: v.string(),
    values: v.record(v.string(), v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("auto_published"),
    ),
  },
  returns: v.object({
    submissionId: v.id("submissions"),
    successMessage: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const form = await ctx.db.get("forms", args.formId);
    if (!form || form.guildId !== args.guildId) {
      throw new ConvexError({ code: "form_not_found" });
    }

    // Runs before caps so garbage input never takes a cap slot. Produces the
    // normalized values that actually get stored; downstream code reads
    // `cleanValues` instead of the raw user-supplied map.
    const cleanValues = validateAndSanitize(form.fields, args.values);

    const submittedAt = Date.now();

    if (form.maxSubmissionsPerUser !== undefined) {
      const existingForUser = await ctx.db
        .query("submissions")
        .withIndex("by_formid_and_submitterid_and_submittedat", (q) =>
          q.eq("formId", args.formId).eq("submitterId", args.submitterId),
        )
        .take(form.maxSubmissionsPerUser);
      if (existingForUser.length >= form.maxSubmissionsPerUser) {
        throw new ConvexError({
          code: "submission_limit_reached",
          limit: form.maxSubmissionsPerUser,
        });
      }
    }

    if (form.maxSubmissionsPerDay !== undefined) {
      const dayStart = submittedAt - (submittedAt % 86_400_000);
      const todaySubmissions = await ctx.db
        .query("submissions")
        .withIndex("by_formid_and_submitterid_and_submittedat", (q) =>
          q
            .eq("formId", args.formId)
            .eq("submitterId", args.submitterId)
            .gte("submittedAt", dayStart),
        )
        .take(form.maxSubmissionsPerDay);
      if (todaySubmissions.length >= form.maxSubmissionsPerDay) {
        throw new ConvexError({
          code: "daily_submission_limit_reached",
          limit: form.maxSubmissionsPerDay,
        });
      }
    }

    // Ticket-mode rows open immediately so the cron and the UI have a status
    // to render as soon as the row exists. Non-ticket forms leave ticket
    // columns undefined so nothing changes for existing behavior.
    const initialTicketStatus = form.ticketMode ? "open" : undefined;

    const submissionId = await ctx.db.insert("submissions", {
      guildId: args.guildId,
      formId: args.formId,
      submitterId: args.submitterId,
      submitterName: args.submitterName,
      submittedAt,
      values: cleanValues,
      status: args.status,
      modQueueMessageId: undefined,
      modQueueChannelId: undefined,
      publishedMessageId: undefined,
      publishedThreadId: undefined,
      decidedBy: undefined,
      decidedAt: undefined,
      denyReason: undefined,
      ticketStatus: initialTicketStatus,
      lastActivityAt: submittedAt,
    });

    // Audit row so the form-level log page shows every intake event. Actor
    // is the Discord user id so moderators can tell where the submission
    // originated. Metadata carries the submitter name for display.
    await ctx.db.insert("auditLog", {
      guildId: args.guildId,
      actorId: args.submitterId,
      action: "submission_created",
      submissionId,
      formId: args.formId,
      metadata: {
        submitterName: args.submitterName,
        initialStatus: args.status,
      },
    });

    // Hand off to the Discord-side router. It will either post the mod queue
    // embed (pending) or publish directly to the destination (auto_published).
    // Runs after this mutation commits so the action can read the new row.
    await ctx.scheduler.runAfter(0, internal.discord.routeSubmission, {
      submissionId,
    });

    return {
      submissionId,
      successMessage: form.successMessage,
    };
  },
});

// Everything the Discord REST actions need to route a submission: the
// answers, the form routing knobs, and the guild bot credentials. Bundling
// into one query keeps the action from issuing three sequential round trips.
const routeContextValidator = v.object({
  submission: v.object({
    _id: v.id("submissions"),
    _creationTime: v.number(),
    guildId: v.id("guilds"),
    formId: v.id("forms"),
    submitterId: v.string(),
    submitterName: v.string(),
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
    ticketStatus: v.optional(
      v.union(
        v.literal("open"),
        v.literal("in_progress"),
        v.literal("resolved"),
        v.literal("closed"),
      ),
    ),
    assignedToUserId: v.optional(v.string()),
    assignedToUserName: v.optional(v.string()),
    assignedAt: v.optional(v.number()),
    lastActivityAt: v.optional(v.number()),
  }),
  form: v.object({
    _id: v.id("forms"),
    title: v.string(),
    description: v.optional(v.string()),
    requiresApproval: v.boolean(),
    modQueueChannelId: v.optional(v.string()),
    destinationChannelId: v.optional(v.string()),
    destinationType: v.optional(v.union(v.literal("text"), v.literal("forum"))),
    forumTagId: v.optional(v.string()),
    titleSource: v.union(v.literal("static"), v.literal("field")),
    titleTemplate: v.optional(v.string()),
    titleFieldId: v.optional(v.string()),
    modRoleIds: v.optional(v.array(v.string())),
    showModeratorInFooter: v.optional(v.boolean()),
    linkSubmitterOnPublish: v.optional(v.boolean()),
    ticketMode: v.optional(v.boolean()),
    autoCloseInactiveDays: v.optional(v.number()),
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
        minValue: v.optional(v.number()),
        maxValue: v.optional(v.number()),
        currencyUnit: v.optional(v.string()),
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
  }),
  guild: v.object({
    _id: v.id("guilds"),
    discordGuildId: v.string(),
    applicationId: v.string(),
    botToken: v.string(),
  }),
});

export const routeContext = internalQuery({
  args: { submissionId: v.id("submissions") },
  returns: v.union(v.null(), routeContextValidator),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) return null;
    const form = await ctx.db.get("forms", submission.formId);
    if (!form) return null;
    const guild = await ctx.db.get("guilds", submission.guildId);
    if (!guild) return null;

    return {
      submission: {
        _id: submission._id,
        _creationTime: submission._creationTime,
        guildId: submission.guildId,
        formId: submission.formId,
        submitterId: submission.submitterId,
        submitterName: submission.submitterName,
        values: submission.values,
        status: submission.status,
        modQueueMessageId: submission.modQueueMessageId,
        modQueueChannelId: submission.modQueueChannelId,
        publishedMessageId: submission.publishedMessageId,
        publishedThreadId: submission.publishedThreadId,
        decidedBy: submission.decidedBy,
        decidedAt: submission.decidedAt,
        denyReason: submission.denyReason,
        ticketStatus: submission.ticketStatus,
        assignedToUserId: submission.assignedToUserId,
        assignedToUserName: submission.assignedToUserName,
        assignedAt: submission.assignedAt,
        lastActivityAt: submission.lastActivityAt,
      },
      form: {
        _id: form._id,
        title: form.title,
        description: form.description,
        requiresApproval: form.requiresApproval,
        modQueueChannelId: form.modQueueChannelId,
        destinationChannelId: form.destinationChannelId,
        destinationType: form.destinationType,
        forumTagId: form.forumTagId,
        titleSource: form.titleSource,
        titleTemplate: form.titleTemplate,
        titleFieldId: form.titleFieldId,
        modRoleIds: form.modRoleIds,
        showModeratorInFooter: form.showModeratorInFooter,
        linkSubmitterOnPublish: form.linkSubmitterOnPublish,
        ticketMode: form.ticketMode,
        autoCloseInactiveDays: form.autoCloseInactiveDays,
        fields: form.fields.map((field) => ({
          id: field.id,
          label: field.label,
          type: field.type,
          minValue: field.minValue,
          maxValue: field.maxValue,
          currencyUnit: field.currencyUnit,
          options: field.options,
        })),
      },
      guild: {
        _id: guild._id,
        discordGuildId: guild.discordGuildId,
        applicationId: guild.applicationId,
        botToken: guild.botToken,
      },
    };
  },
});

// Writes the Discord message id back onto the submission so later edits (to
// flip "Approved"/"Denied") can PATCH the same message.
export const markModQueuePosted = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    messageId: v.string(),
    channelId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) return null;
    await ctx.db.patch("submissions", args.submissionId, {
      modQueueMessageId: args.messageId,
      modQueueChannelId: args.channelId,
    });
    // Success audit so the log page shows the mod queue post landed.
    await ctx.db.insert("auditLog", {
      guildId: submission.guildId,
      actorId: "system",
      action: "mod_queue_posted",
      submissionId: args.submissionId,
      formId: submission.formId,
      metadata: { channelId: args.channelId, messageId: args.messageId },
    });
    return null;
  },
});

export const markPublished = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    messageId: v.optional(v.string()),
    threadId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) return null;
    await ctx.db.patch("submissions", args.submissionId, {
      publishedMessageId: args.messageId,
      publishedThreadId: args.threadId,
    });
    await ctx.db.insert("auditLog", {
      guildId: submission.guildId,
      actorId: "system",
      action: "submission_published",
      submissionId: args.submissionId,
      formId: submission.formId,
      metadata: {
        messageId: args.messageId,
        threadId: args.threadId,
      },
    });
    return null;
  },
});

// Shared implementation for approve/deny. Both the Discord button path
// (`recordDecision`) and the dashboard path (`decide`) call this directly so
// the transition, audit row, and follow up schedules stay identical without
// paying the cost of a nested `ctx.runMutation` (which re-evaluates
// `convex/auth.ts` in a fresh isolate and blew up with a missing
// `CONVEX_SITE_URL` env var).
async function applyDecision(
  ctx: MutationCtx,
  args: {
    submissionId: Id<"submissions">;
    decision: "approved" | "denied";
    moderatorId: string;
    moderatorName: string;
    denyReason?: string;
  },
): Promise<{ alreadyDecided: boolean; decidedByName?: string }> {
  const submission = await ctx.db.get("submissions", args.submissionId);
  if (!submission) {
    throw new ConvexError({ code: "submission_not_found" });
  }

  // First decision wins; return the current state so the caller can show
  // "Already handled by …" without clobbering the existing record.
  if (submission.status === "approved" || submission.status === "denied") {
    return {
      alreadyDecided: true,
      decidedByName: submission.decidedBy,
    };
  }

  const decidedAt = Date.now();
  await ctx.db.patch("submissions", args.submissionId, {
    status: args.decision,
    decidedBy: args.moderatorName,
    decidedAt,
    denyReason: args.decision === "denied" ? args.denyReason : undefined,
    lastActivityAt: decidedAt,
  });

  await ctx.db.insert("auditLog", {
    guildId: submission.guildId,
    actorId: args.moderatorId,
    action:
      args.decision === "approved"
        ? "submission_approved"
        : "submission_denied",
    submissionId: submission._id,
    formId: submission.formId,
    metadata: {
      moderatorName: args.moderatorName,
      denyReason: args.denyReason,
    },
  });

  if (args.decision === "approved") {
    await ctx.scheduler.runAfter(0, internal.discord.publishSubmission, {
      submissionId: submission._id,
    });
  }

  await ctx.scheduler.runAfter(0, internal.discord.updateModQueueMessage, {
    submissionId: submission._id,
  });

  await ctx.scheduler.runAfter(0, internal.discord.sendDecisionDM, {
    submissionId: submission._id,
    decision: args.decision,
    denyReason: args.denyReason,
  });

  return { alreadyDecided: false, decidedByName: args.moderatorName };
}

// Called from the button and modal handlers after the mod role check passes.
// Transitions the submission, writes the audit row, and schedules the follow
// up Discord work (publish on approve, DM on both). The HTTP handler still
// responds to Discord synchronously with an updated embed so the moderator
// gets instant feedback.
export const recordDecision = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    decision: v.union(v.literal("approved"), v.literal("denied")),
    moderatorId: v.string(),
    moderatorName: v.string(),
    denyReason: v.optional(v.string()),
  },
  returns: v.object({
    alreadyDecided: v.boolean(),
    decidedByName: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    return await applyDecision(ctx, args);
  },
});

// Allowed transitions between ticket states. `claim` and `unclaim` act on
// ticketStatus === "open" | "in_progress"; `resolve` moves to resolved;
// `reopen` goes back to open from resolved or closed; `close` is the
// terminal state. `auto_close` is the same as `close` but tagged for audit.
type TicketAction =
  | "claim"
  | "unclaim"
  | "resolve"
  | "reopen"
  | "close"
  | "auto_close";

const ticketActionValidator = v.union(
  v.literal("claim"),
  v.literal("unclaim"),
  v.literal("resolve"),
  v.literal("reopen"),
  v.literal("close"),
  v.literal("auto_close"),
);

// Shared helper used by the Discord button path, the cron sweep, and
// (eventually) a dashboard override. Enforces transition rules, patches
// lifecycle columns, and schedules the published-message refresh so
// Discord reflects the new state immediately.
async function applyTicketAction(
  ctx: MutationCtx,
  args: {
    submissionId: Id<"submissions">;
    action: TicketAction;
    actorId: string;
    actorName: string;
  },
): Promise<{ ok: boolean; reason?: string }> {
  const submission = await ctx.db.get("submissions", args.submissionId);
  if (!submission) {
    return { ok: false, reason: "submission_not_found" };
  }
  const form = await ctx.db.get("forms", submission.formId);
  if (!form || !form.ticketMode) {
    return { ok: false, reason: "not_ticket_form" };
  }

  const now = Date.now();
  const current = submission.ticketStatus ?? "open";
  const patch: Partial<Doc<"submissions">> = { lastActivityAt: now };

  if (args.action === "claim") {
    if (current === "closed") return { ok: false, reason: "ticket_closed" };
    if (
      submission.assignedToUserId &&
      submission.assignedToUserId !== args.actorId
    ) {
      return {
        ok: false,
        reason: "already_claimed",
      };
    }
    patch.assignedToUserId = args.actorId;
    patch.assignedToUserName = args.actorName;
    patch.assignedAt = now;
    patch.ticketStatus = current === "open" ? "in_progress" : current;
  } else if (args.action === "unclaim") {
    if (submission.assignedToUserId !== args.actorId) {
      return { ok: false, reason: "not_assignee" };
    }
    patch.assignedToUserId = undefined;
    patch.assignedToUserName = undefined;
    patch.assignedAt = undefined;
    patch.ticketStatus = current === "in_progress" ? "open" : current;
  } else if (args.action === "resolve") {
    if (current === "closed") return { ok: false, reason: "ticket_closed" };
    patch.ticketStatus = "resolved";
  } else if (args.action === "reopen") {
    if (current === "open" || current === "in_progress") {
      return { ok: false, reason: "ticket_already_open" };
    }
    patch.ticketStatus = submission.assignedToUserId ? "in_progress" : "open";
  } else if (args.action === "close" || args.action === "auto_close") {
    if (current === "closed") return { ok: false, reason: "already_closed" };
    patch.ticketStatus = "closed";
  }

  await ctx.db.patch("submissions", args.submissionId, patch);

  await ctx.db.insert("auditLog", {
    guildId: submission.guildId,
    actorId: args.actorId,
    action: `ticket_${args.action}`,
    submissionId: submission._id,
    formId: submission.formId,
    metadata: { actorName: args.actorName },
  });

  // Refresh the published Discord message so the embed footer and button
  // row reflect the new state. Archive or unarchive the forum thread on
  // close and reopen to match.
  await ctx.scheduler.runAfter(
    0,
    internal.discord.updatePublishedTicketMessage,
    { submissionId: submission._id },
  );
  if (args.action === "close" || args.action === "auto_close") {
    await ctx.scheduler.runAfter(0, internal.discord.archiveForumThread, {
      submissionId: submission._id,
      archived: true,
    });
  } else if (args.action === "reopen") {
    await ctx.scheduler.runAfter(0, internal.discord.archiveForumThread, {
      submissionId: submission._id,
      archived: false,
    });
  }

  return { ok: true };
}

// Public to the Discord button path. Auth happens in `http.ts`: we verify
// the Ed25519 signature and then check the mod role list before calling
// this mutation. Returns a small result so the HTTP handler can pick the
// right ephemeral message.
export const recordTicketAction = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    action: ticketActionValidator,
    actorId: v.string(),
    actorName: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    return await applyTicketAction(ctx, args);
  },
});

// Hourly cron. Walks `open` and `in_progress` tickets in lastActivityAt
// order so the oldest rows surface first; stops at a budget so a backlog
// can't exhaust the 60-second action wall. Each matching row gets an
// `auto_close` applied via `applyTicketAction` so the audit row and the
// published-message refresh stay consistent with manual closes.
export const sweepAutoCloseTickets = internalMutation({
  args: {},
  returns: v.object({
    scanned: v.number(),
    closed: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const BUDGET = 50;
    let scanned = 0;
    let closed = 0;

    // We sweep open first, then in_progress. Both share the same index.
    for (const status of ["open", "in_progress"] as const) {
      if (scanned >= BUDGET) break;
      const remaining = BUDGET - scanned;
      const rows = await ctx.db
        .query("submissions")
        .withIndex("by_ticketstatus_and_lastactivityat", (q) =>
          q.eq("ticketStatus", status),
        )
        .order("asc")
        .take(remaining);
      scanned += rows.length;

      for (const submission of rows) {
        const form = await ctx.db.get("forms", submission.formId);
        if (!form || !form.ticketMode) continue;
        const windowDays = form.autoCloseInactiveDays;
        if (!windowDays || windowDays <= 0) continue;
        const lastActivity = submission.lastActivityAt ?? submission.submittedAt ?? submission._creationTime;
        const cutoff = now - windowDays * 86_400_000;
        if (lastActivity >= cutoff) continue;

        const result = await applyTicketAction(ctx, {
          submissionId: submission._id,
          action: "auto_close",
          actorId: "system",
          actorName: "auto-close",
        });
        if (result.ok) closed += 1;
      }
    }

    return { scanned, closed };
  },
});

// Dashboard reply. Authenticated via `requireAllowedViewer`. Posts a
// mod-authored message into the submission's published Discord thread
// (forum destinations) or as a Discord reply to the original message
// (text destinations). Never pings because `allowed_mentions.parse = []`.
export const postReply = mutation({
  args: {
    submissionId: v.id("submissions"),
    body: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const viewer = await requireAllowedViewer(ctx);
    const viewerEmail =
      typeof viewer.email === "string" ? viewer.email : undefined;
    const viewerName =
      typeof viewer.name === "string" && viewer.name.trim().length > 0
        ? viewer.name
        : (viewerEmail ?? "moderator");

    const body = args.body.trim();
    if (body.length === 0) {
      throw new ConvexError({ code: "reply_empty" });
    }
    if (body.length > 1800) {
      throw new ConvexError({ code: "reply_too_long", max: 1800 });
    }

    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) {
      throw new ConvexError({ code: "submission_not_found" });
    }
    if (!submission.publishedMessageId && !submission.publishedThreadId) {
      throw new ConvexError({ code: "submission_not_published" });
    }

    const now = Date.now();
    await ctx.db.patch("submissions", args.submissionId, {
      lastActivityAt: now,
    });

    await ctx.db.insert("auditLog", {
      guildId: submission.guildId,
      actorId: viewerEmail ?? "dashboard",
      action: "dashboard_reply",
      submissionId: submission._id,
      formId: submission.formId,
      metadata: { authorName: viewerName },
    });

    await ctx.scheduler.runAfter(0, internal.discord.postReplyToSubmission, {
      submissionId: submission._id,
      authorName: viewerName,
      body,
    });

    return { ok: true };
  },
});

// Audit rows for skipped routing paths (missing channel, Discord error,
// DMs closed). Keeping this centralized so the action code does not need
// direct `ctx.db` access.
export const logRoutingSkip = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    reason: v.string(),
    detail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) return null;
    await ctx.db.insert("auditLog", {
      guildId: submission.guildId,
      actorId: "system",
      action: args.reason,
      submissionId: submission._id,
      formId: submission.formId,
      metadata: args.detail ? { detail: args.detail } : undefined,
    });
    return null;
  },
});

async function requireAllowedUser(ctx: QueryCtx | MutationCtx) {
  return await requireAllowedViewer(ctx);
}

// Basic email regex. Intentionally loose since Discord does not validate
// email input for us and we want to accept +aliases, subdomains, and
// unicode TLDs. Rejects obvious junk like "not an email".
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Strips content that could break markdown, escape Discord formatting in
// unintended ways, or smuggle invisible characters into the dashboard.
// Keeps newlines and tabs because long-answer and code fields rely on
// them.
function sanitizeValue(raw: string) {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

type StoredField = {
  id: string;
  label: string;
  type:
    | "short"
    | "paragraph"
    | "email"
    | "code"
    | "select"
    | "yes_no"
    | "checkbox"
    | "number";
  required: boolean;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  currencyUnit?: string;
  options?: Array<{ id: string; label: string }>;
};

// Runs in `insertFromDiscord` before caps. Returns the values that will
// actually be stored (trimmed, sanitized, and for option fields, remapped
// to the option id). Throws a ConvexError on the first invalid field so
// the HTTP handler can turn it into an ephemeral response.
function validateAndSanitize(
  fields: Array<StoredField>,
  values: Record<string, string>,
): Record<string, string> {
  const clean: Record<string, string> = {};

  for (const field of fields) {
    const raw = values[field.id] ?? "";
    const sanitized = sanitizeValue(raw);

    if (sanitized.length === 0) {
      if (field.required) {
        throw new ConvexError({
          code: "field_required",
          fieldId: field.id,
          label: field.label,
        });
      }
      clean[field.id] = "";
      continue;
    }

    if (field.type === "short" || field.type === "paragraph") {
      enforceLength(field, sanitized);
      clean[field.id] = sanitized;
      continue;
    }

    if (field.type === "code") {
      enforceLength(field, sanitized);
      clean[field.id] = sanitized;
      continue;
    }

    if (field.type === "email") {
      enforceLength(field, sanitized);
      if (!EMAIL_REGEX.test(sanitized)) {
        throw new ConvexError({
          code: "field_email_invalid",
          fieldId: field.id,
          label: field.label,
        });
      }
      clean[field.id] = sanitized;
      continue;
    }

    if (field.type === "number") {
      // Strip grouping chars and common currency symbols so "$1,000" and
      // "1 000.50" both parse. We persist a plain numeric string so
      // downstream consumers (CSV, PDF, embeds) can format however they want.
      const stripped = sanitized.replace(/[,\s$€£¥]/g, "");
      const parsed = Number(stripped);
      if (!Number.isFinite(parsed)) {
        throw new ConvexError({
          code: "field_number_invalid",
          fieldId: field.id,
          label: field.label,
        });
      }
      if (field.minValue !== undefined && parsed < field.minValue) {
        throw new ConvexError({
          code: "field_number_too_small",
          fieldId: field.id,
          label: field.label,
          min: field.minValue,
        });
      }
      if (field.maxValue !== undefined && parsed > field.maxValue) {
        throw new ConvexError({
          code: "field_number_too_large",
          fieldId: field.id,
          label: field.label,
          max: field.maxValue,
        });
      }
      clean[field.id] = String(parsed);
      continue;
    }

    // Option types (select, yes_no, checkbox): the raw value is expected
    // to be one of the option ids. Accept the option label too as a
    // courtesy in case a custom client submitted it.
    const options = field.options ?? [];
    const match = options.find(
      (option) =>
        option.id === sanitized.toLowerCase() ||
        option.label === sanitized ||
        option.label.toLowerCase() === sanitized.toLowerCase(),
    );
    if (!match) {
      throw new ConvexError({
        code: "field_option_invalid",
        fieldId: field.id,
        label: field.label,
      });
    }
    clean[field.id] = match.id;
  }

  return clean;
}

function enforceLength(field: StoredField, value: string) {
  if (field.minLength !== undefined && value.length < field.minLength) {
    throw new ConvexError({
      code: "field_too_short",
      fieldId: field.id,
      label: field.label,
      min: field.minLength,
    });
  }
  if (field.maxLength !== undefined && value.length > field.maxLength) {
    throw new ConvexError({
      code: "field_too_long",
      fieldId: field.id,
      label: field.label,
      max: field.maxLength,
    });
  }
}
