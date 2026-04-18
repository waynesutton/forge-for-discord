// Read model for the per-form activity log shown on the dashboard. Every
// intake event (submission created, mod queue posted, published, approved,
// denied, ticket action, Discord routing failure) already writes a row into
// `auditLog`. This query joins by `formId` and returns a shape the React
// page can render directly.
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAllowedViewer } from "./lib/auth";

// Actions that represent a failed Discord-side step. Surfaced as the
// "error" severity on the log page so moderators can spot routing issues.
// Kept in one place so the frontend and the query agree.
const ERROR_ACTIONS: ReadonlySet<string> = new Set([
  "mod_queue_channel_missing",
  "mod_queue_post_failed",
  "publish_text_failed",
  "publish_forum_failed",
  "publish_skipped_destination_missing",
  "update_published_failed",
  "archive_thread_failed",
  "post_reply_failed",
  "dm_send_failed",
]);

const logEntryValidator = v.object({
  _id: v.id("auditLog"),
  _creationTime: v.number(),
  action: v.string(),
  actorId: v.string(),
  submissionId: v.optional(v.id("submissions")),
  metadata: v.optional(v.any()),
  severity: v.union(v.literal("info"), v.literal("error")),
  submitterName: v.optional(v.string()),
  detail: v.optional(v.string()),
});

export const listForForm = query({
  args: {
    formId: v.id("forms"),
  },
  returns: v.array(logEntryValidator),
  handler: async (ctx, args) => {
    await requireAllowedViewer(ctx);

    // Tail is enough for a first pass. 300 rows covers a busy day of
    // submissions without dragging the query cost up.
    const rows = await ctx.db
      .query("auditLog")
      .withIndex("by_formid", (q) => q.eq("formId", args.formId))
      .order("desc")
      .take(300);

    // Submitter name comes from the submission doc when present so the log
    // can show "submitted by @alice" without us denormalizing more fields
    // into the audit row.
    const submissionIds = Array.from(
      new Set(
        rows.flatMap((row) => (row.submissionId ? [row.submissionId] : [])),
      ),
    );
    const submissionNameById = new Map<string, string>();
    for (const id of submissionIds) {
      const submission = await ctx.db.get("submissions", id);
      if (submission) {
        submissionNameById.set(id, submission.submitterName);
      }
    }

    return rows.map((row) => {
      const metadata = (row.metadata ?? undefined) as
        | Record<string, unknown>
        | undefined;
      const detail =
        metadata && typeof metadata.detail === "string"
          ? metadata.detail
          : undefined;
      return {
        _id: row._id,
        _creationTime: row._creationTime,
        action: row.action,
        actorId: row.actorId,
        submissionId: row.submissionId,
        metadata: row.metadata,
        severity: (ERROR_ACTIONS.has(row.action) ? "error" : "info") as
          | "info"
          | "error",
        submitterName: row.submissionId
          ? submissionNameById.get(row.submissionId)
          : undefined,
        detail,
      };
    });
  },
});
