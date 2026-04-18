# Submission moderation and results styling

## Problem

The results page is read-only. Admins cannot clean up spam, hide noise from
their view, or remove a row once a test run is done. On top of that, the
page is purely text so it is hard to skim a long list of pending versus
approved versus denied items.

## Proposed solution

Two small slices in one pass.

### Moderation

- New optional `hiddenAt` field on `submissions` so rows can be soft hidden
  from the dashboard without touching Discord.
- New `submissions.setHidden` admin-gated mutation that toggles the field.
- New `submissions.deleteSubmission` admin-gated mutation that captures the
  stored Discord message ids, deletes the row, and (only when the caller
  opts in) schedules `internal.discord.deleteDiscordMessages` to clean up
  the mod queue embed and the published message via Discord REST.
- `submissions.listForForm` gains an `includeHidden` arg, defaulting to
  false so the list hides by default.
- Caps in `insertFromDiscord` keep counting hidden rows. The user confirmed
  this, and it means spam that got hidden cannot come back under the same
  account.

### Styling

- Colored status pills on the results page (pending, approved, denied,
  auto-published) using the existing brand palette.
- Per-row action menu with Hide or Unhide plus Delete.
- Delete confirm dialog with a checkbox "Also remove the Discord messages"
  defaulting off.
- "Show hidden submissions" toggle above the list.
- Small typography pass so field labels look consistent with the editor
  (uppercase meta, mono-spaced values wrapping nicely).

Discord embeds stay as-is. The approved screenshot from today already
renders cleanly.

## Files to change

- `convex/schema.ts` — add `hiddenAt: v.optional(v.number())` to
  `submissions`.
- `convex/submissions.ts` — add `setHidden`, `deleteSubmission`, extend
  `listForForm` with `includeHidden`, update the row validator.
- `convex/discord.ts` — add `deleteDiscordMessages` internal action that
  DELETEs a list of `{channelId, messageId}` pairs via the Discord REST
  API using the guild bot token.
- `src/pages/FormResults.tsx` — hide toggle, row action menu, delete
  confirm dialog, status pill component, Copy button per field value,
  small typography polish.
- `TASK.md`, `changelog.md`, `files.md` — document the change.

## Edge cases

- Hide a row that never posted to Discord: no Discord id stored, works
  fine, just flips the flag.
- Delete a row whose mod queue embed was already removed: Discord returns
  404, we swallow and log via `submissions.logRoutingSkip` with reason
  `discord_delete_missing`.
- Delete a row whose published message was in a forum thread: we attempt
  to delete the starter message only. The thread itself stays since a bot
  with Manage Threads could orphan unrelated activity inside it.
- Toggle a row between hidden and visible: no Discord side effect.
- Current-user caps: hidden or deleted rows still count for `maxSubmissionsPerUser`
  because we never filter caps by hidden state. Intentional per PRD.

## Verification

- Submit a form, hide it, see it disappear from the results list.
- Toggle "Show hidden", see it back with a muted style.
- Delete without the checkbox, confirm the Discord embed still exists.
- Delete with the checkbox, confirm both the mod queue embed and the
  destination message disappear.
- `npx tsc --noEmit` and `npm run lint:code` both pass.

## Out of scope

- Bulk actions (select many rows and delete).
- Undo for hard delete.
- Editing submitted values.
- Discord thread deletion.
- Avatar thumbnails on the results page.
