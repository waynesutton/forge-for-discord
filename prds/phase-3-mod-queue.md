# Phase 3 mod queue and approvals

## Problem

Phase 2 landed the form builder, slash command registration, modal submit, and
the raw `submissions` write path. Today, after a member submits a form:

- The row is stored with status `pending` or `auto_published`
- Nothing posts to Discord for mods to review
- There is no Approve or Deny flow
- Nothing lands in a destination channel or forum
- The submitter only gets an ephemeral ack inside the modal

Phase 3 closes that gap so forms actually move from submit to review to publish.

## Proposed solution

Drive the review flow from the existing Convex `/interactions` HTTP endpoint
plus a set of Convex actions and internal mutations.

1. When `insertFromDiscord` commits, schedule an action that either posts a
   review embed with Approve + Deny buttons to `form.modQueueChannelId` or
   publishes directly to the destination when `requiresApproval === false`.
2. Handle Discord `MESSAGE_COMPONENT` (type 3) clicks for:
   - `approve:<submissionId>` records the decision immediately.
   - `deny:<submissionId>` opens a reason modal.
3. Handle `MODAL_SUBMIT` with `custom_id` `deny:<submissionId>` to capture the
   reason and record the decision.
4. On approve, publish to destination (text channel message or forum thread)
   and DM submitter. On deny, DM submitter with the reason and skip publish.
5. Update the mod queue message in place so the same Discord message reflects
   the final decision.
6. Record every decision in `auditLog`.

## Files to change

- `convex/submissions.ts`
  - Extend `insertFromDiscord` to schedule `internal.discord.routeSubmission`
    after insert.
  - Add `routeContext` internal query: submission plus form routing plus guild
    auth.
  - Add `recordDecision` internal mutation: transition to approved or denied,
    write audit row, fan out follow-up actions.
  - Add `markModQueuePosted`, `markPublished` internal mutations to persist
    Discord message ids.
  - Add `getDecisionContext` internal query for button and modal handlers.
- `convex/discord.ts`
  - `routeSubmission` action: branches on `requiresApproval`.
  - `postToModQueue` action: builds embed plus buttons and sends via REST,
    then records `modQueueMessageId`.
  - `updateModQueueMessage` action: patches the review embed to show the
    final decision.
  - `publishSubmission` action: posts to text channel or creates forum
    thread with `applied_tags` plus templated title and content.
  - `sendDecisionDM` action: opens a DM channel and sends a submitter
    message.
  - Helpers for embed building, `{fieldId}` title interpolation, Discord
    markdown escape.
- `convex/http.ts`
  - Branches for `type === 3` (MESSAGE_COMPONENT) with `custom_id`
    `approve:<id>` or `deny:<id>`. Approve enforces mod role and records a
    decision. Deny enforces mod role and opens a reason modal.
  - Extend `type === 5` (MODAL_SUBMIT) branch for `custom_id` starting with
    `deny:`.
  - Shared helper `ensureModRole(form, member)` that treats undefined or
    empty `modRoleIds` as "any member who can already see the mod channel".
- No schema changes needed. All Discord message id fields (`modQueueMessageId`,
  `modQueueChannelId`, `publishedMessageId`, `publishedThreadId`, `decidedBy`,
  `decidedAt`, `denyReason`) already exist.

## Edge cases

- Mod queue channel not configured while `requiresApproval` is on: skip the
  post, add an audit row `mod_queue_channel_missing`, keep submission pending.
- Destination missing on approve: mark approved, DM submitter, audit
  `publish_skipped_destination_missing`.
- Discord 403 or 404 (channel deleted, bot kicked): catch, audit, do not throw.
- Double click on Approve or Deny: if already decided, respond ephemerally
  "Already handled by @name".
- Empty deny reason: allow, store empty string.
- Forum title template referencing a missing field: fall back to `form.title`.
- Submitter has closed DMs: Discord returns error; catch and audit.
- Race between approve and deny: first decision wins.
- Discord 3 second rule: button clicks reply with `type: 7` UPDATE_MESSAGE and
  the follow-up publish plus DM run via `ctx.scheduler`.

## Verification

- Submit a form with `requiresApproval` on; see review embed with Approve and
  Deny buttons.
- Approve click from a non-mod member returns an ephemeral refusal.
- Approve click from a mod updates the embed to "Approved", publishes to the
  destination channel or forum, and DMs the submitter.
- Deny click opens the reason modal; submitting the modal updates the embed,
  DMs the submitter, and records the reason.
- `auditLog` rows exist for each decision.
- `/app/forms/:formId/results` reflects the new statuses and decided-at time.

## Out of scope for this slice

- Cooldown enforcement on `insertFromDiscord`
- Full-feature submission inbox page with filters
- Audit log reader page
- Editing a published message after the fact
- Attachments or file uploads
