# Ticket mode, number field type, and dashboard reply

## Problem

Forms today are one-shot intake: submit, get approved or denied, get published, done. Two use cases need more:

1. **Support requests.** Admins want a submitted issue to have a lifecycle (open → in_progress → resolved → closed), a clear owner once a mod takes it on, automatic cleanup of abandoned tickets, and a way for mods to reply without leaving the dashboard.
2. **Code review bounties.** Admins want a numeric bounty amount with a readable currency tag (for example `$500 USD`, `1000 credits`). No wallet, no payouts, no file attachments. Display only.

Both paths must stay opt-in per form and must not alter the current intake, approval, or publish flow when the toggles are off.

## Goals

- New `"number"` field type with optional min, max, and currency unit, rendered everywhere the other field types already render.
- Per-form `ticketMode` toggle that enables ticket lifecycle buttons on the published message: Claim, Unclaim, Resolve, Reopen, Close.
- Per-form `autoCloseInactiveDays` that closes stale tickets on a cron sweep and archives the forum thread when applicable.
- Per-row dashboard reply box that posts a moderator reply into the published Discord thread or message.
- Works with approval on or off. Works with text and forum destinations.
- Does not change behavior for existing forms with the new flags left undefined.

## Non goals

- File attachments.
- Any bounty wallet, payment flow, escrow, or ledger. Currency is a pure display string.
- SLA tracking, priorities beyond what a `select` field already provides.
- Client-side Discord embeds for the currency (we render server-side strings).

## Schema changes

```
forms:
  + ticketMode: v.optional(v.boolean())
  + autoCloseInactiveDays: v.optional(v.number())  // 0 or undefined = never
  fields[].:
    + minValue: v.optional(v.number())
    + maxValue: v.optional(v.number())
    + currencyUnit: v.optional(v.string())
    type union: + v.literal("number")

submissions:
  + ticketStatus: v.optional(v.union(
      v.literal("open"), v.literal("in_progress"),
      v.literal("resolved"), v.literal("closed"),
    ))
  + assignedToUserId: v.optional(v.string())
  + assignedToUserName: v.optional(v.string())
  + assignedAt: v.optional(v.number())
  + lastActivityAt: v.optional(v.number())
  + new index by_ticketstatus_and_lastactivityat: ["ticketStatus", "lastActivityAt"]
```

`ticketStatus` is orthogonal to approval `status`. Approval status gates whether the submission is published at all. Ticket status tracks the lifecycle after publish. `lastActivityAt` seeds from `submittedAt` on insert and bumps on every mod action (claim, resolve, reopen, close, reply, approve, deny).

## Proposed solution

### 1. Number field type

- `convex/schema.ts` adds `"number"` to the type union and adds `minValue`, `maxValue`, `currencyUnit` to the field object.
- `convex/forms.ts` accepts the new knobs in `formFieldValidator`, `normalizeFields` validates `minValue <= maxValue`, rejects non-finite numbers, and strips `options` / `minLength` / `maxLength` for number fields.
- `convex/submissions.ts` extends `validateAndSanitize` with a `"number"` branch. Strips grouping commas and spaces, parses with `Number`, rejects NaN or non-finite, enforces min and max, stores the normalized string.
- `convex/http.ts` builds number fields as `TEXT_INPUT` style `SHORT` in both classic and Label-wrapped modals (Discord has no native number input). Helper text signals it must be a number.
- `convex/discord.ts` `formatFieldValue` renders number values with `Intl.NumberFormat("en-US")` and appends `currencyUnit` when set, producing `1,000 USD` or `0.5 credits`.
- `src/pages/EditForm.tsx` adds a "Number" entry to `FIELD_TYPE_META`, shows min-value / max-value / currency-unit inputs in `FieldEditor` when the type is number, and hides the length and options editors for number.
- `src/pages/FormResults.tsx` and `src/lib/exportResults.ts` render numbers with the same formatter so CSV, PDF, and the in-page list match the Discord embed.

### 2. Ticket mode + lifecycle

- `convex/schema.ts` adds the `ticketMode` and `autoCloseInactiveDays` flags and the submission lifecycle columns above.
- `convex/submissions.ts` `insertFromDiscord` seeds `lastActivityAt = submittedAt` and, when `form.ticketMode`, sets `ticketStatus = "open"` on the row after publish (we seed open on insert so the cron does not have to special-case).
- New internal mutation `submissions.applyTicketAction(ctx, { submissionId, action, actorId, actorName })`:
  - Validates the transition (open ↔ in_progress, → resolved, → closed, ↔ reopen from resolved).
  - Patches `ticketStatus`, `assignedToUserId`, `assignedToUserName`, `assignedAt`, `lastActivityAt`.
  - Appends an `auditLog` row with the action name.
  - Schedules `internal.discord.updatePublishedTicketMessage` to rebuild the embed and buttons.
  - Schedules `internal.discord.archiveForumThread` with `archived: true` on Close; unarchive on Reopen.
- `convex/discord.ts`:
  - New `buildTicketComponents(submission, form)` returns the button row conditional on the current state.
  - `publishSubmissionImpl` adds the components to the POST body when `form.ticketMode`.
  - New `internal.discord.updatePublishedTicketMessage` PATCHes `publishedMessageId` (or the forum thread starter message) with the fresh embed + components.
  - New `internal.discord.archiveForumThread` PATCHes `/channels/{id}` with `archived` flag.
- `convex/http.ts` MESSAGE_COMPONENT handler gains prefixes: `claim:<id>`, `unclaim:<id>`, `resolve:<id>`, `reopen:<id>`, `close:<id>`. All gate on `modRoleIds` (same as approve/deny).
- `buildSubmissionEmbed` footer adds "Assigned to {name}" when present and a status tag when `ticketMode` is on.

### 3. Auto close after N days inactivity

- New `convex/crons.ts` (does not exist yet):
  ```ts
  crons.interval(
    "auto close inactive tickets",
    { hours: 1 },
    internal.submissions.sweepAutoCloseTickets,
    {},
  );
  ```
- `internal.submissions.sweepAutoCloseTickets` uses the new `by_ticketstatus_and_lastactivityat` index to page through `open` and `in_progress` rows with `lastActivityAt < now - form.autoCloseInactiveDays * 86_400_000`. Skips rows whose form has `autoCloseInactiveDays` undefined or 0.
- Each hit gets an `applyTicketAction(..., action: "auto_close")` call, which logs `ticket_auto_close` in the audit table and schedules the embed edit and optional thread archive. Budget: 50 rows per sweep so a backlog does not blow the 60-second action wall.

### 4. Dashboard reply

- New public mutation `submissions.postReply({ submissionId, body })`:
  - `requireAllowedUser`, validates non-empty trimmed body, enforces 1800-char cap (Discord message limit minus a safety cushion).
  - Loads the submission, rejects if there is no `publishedMessageId` and no `publishedThreadId` (nothing to reply to yet).
  - Patches `lastActivityAt`.
  - Appends an `auditLog` row `dashboard_reply`.
  - Schedules `internal.discord.postReplyToSubmission` with the viewer name and body.
- `internal.discord.postReplyToSubmission`:
  - For forum destinations: POST `/channels/{publishedThreadId}/messages` with `content = "**{name}** (mod): {body}"`, `allowed_mentions.parse = []`.
  - For text destinations: POST `/channels/{destinationChannelId}/messages` with `message_reference = { message_id: publishedMessageId }` so Discord renders the native reply pointer.
  - Logs a `submissions.logRoutingSkip` row on failure.
- `src/pages/FormResults.tsx` adds a `RowAction` button "Reply" with `ChatCircle` icon. Opens a new `ReplyDialog` component that reuses the existing dialog shell pattern (see `DenySubmissionDialog`).

## Files to change

- `convex/schema.ts` — field type, flags, submission columns, new index.
- `convex/forms.ts` — validator, update args, patch, `toEditableForm`, `normalizeFields` number branch.
- `convex/submissions.ts` — validation branch for number, `applyTicketAction`, `sweepAutoCloseTickets`, `postReply`, `routeContext` extensions.
- `convex/discord.ts` — `buildTicketComponents`, `updatePublishedTicketMessage`, `archiveForumThread`, `postReplyToSubmission`, `formatFieldValue` number branch, publish plumbing.
- `convex/http.ts` — new MESSAGE_COMPONENT prefixes, number field modal builder, audit values for ticket actions.
- `convex/crons.ts` — new file, single interval.
- `src/pages/EditForm.tsx` — Number field type meta, `FieldEditor` branches, Ticket mode + autoclose toggles.
- `src/pages/FormResults.tsx` — Reply dialog, ticket status pill, assignee display.
- `src/lib/exportResults.ts` — number formatting in CSV / PDF.
- `TASK.md`, `changelog.md`, `files.md` — workflow updates.

## Edge cases

- Number parses: `"1,000"`, `" 42 "`, `"$500"` all coerce to `1000`, `42`, `500` respectively. Unit stays configured on the field, not in the answer.
- Number min / max both optional. If only one is set the other side is unbounded.
- Number field type with `required = false` and empty input stores `""` (same as other types).
- Ticket claim by a non-mod returns an ephemeral "not allowed" response. Claim by self when already assigned returns "already claimed by you".
- Resolve then Reopen bumps `lastActivityAt` so auto close clock restarts.
- Auto close cron ignores submissions with `hiddenAt` or `status === "denied"` or `publishedMessageId` missing.
- Dashboard reply with no `publishedMessageId` returns `submission_not_published` error — UI disables the Reply button when the submission is not published.
- Forum thread that is archived will 403 on message POST. The reply action unarchives (`archived: false`) and retries once before logging a skip.
- Existing forms with `ticketMode` undefined behave exactly as before. No ticket buttons appear, cron skips them.

## Rollout

Ship in four independently verifiable chunks:

1. Number field type end to end (schema, backend, modal, embed, editor, results).
2. Ticket mode schema + button rendering + interaction handlers.
3. Auto close cron.
4. Dashboard reply.

Each chunk ends with `npx tsc --noEmit`, `npx tsc --noEmit -p convex/tsconfig.json`, and `npm run lint:code` clean.
