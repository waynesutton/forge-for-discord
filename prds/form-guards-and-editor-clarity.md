Created: 2026-04-18 08:39 UTC
Last Updated: 2026-04-18 08:39 UTC
Status: Done

# Form guards and editor clarity

## Problem

Forge can publish forms and route submissions, but it still misses a few product level controls that real Discord form tools expose:

- required roles to use a form
- blocked roles that prevent use
- configurable success message content
- submission caps per user
- submission caps per day

The backend also does not cache Discord roles yet, so the editor cannot offer role pickers or validate saved role selections.

The editor has a separate usability issue too:

- command pane controls visually overlap into adjacent panes at large widths
- admins can confuse `Save draft` with `Update published command`
- the UI does not clearly warn when local changes are unsaved or not yet synced to Discord

## Root cause

- `forms` already has a couple of future facing fields like `requiredRoleIds`, but there is no guild role cache, no editor controls, and no submit time enforcement.
- `submissions` does not yet expose the indexes and metadata needed for per form per user usage caps.
- `http.ts` currently opens modals and writes submissions without checking role gates or usage limits.
- `EditForm.tsx` uses a dense grid and sticky pane layout, but several pane wrappers are missing the width constraints needed to stop form controls from overflowing into neighboring columns.

## Proposed solution

### Discord role cache

- Add a `guildRoles` cache table keyed by guild and Discord role id
- Add a role refresh action in `convex/discord.ts`
- Reuse the same cache pattern already used for channels

### Form controls

- Extend `forms` with:
  - `restrictedRoleIds`
  - `successMessage`
  - `maxSubmissionsPerUser`
  - `maxSubmissionsPerDay`
- Keep all fields optional so existing forms stay valid

### Enforcement

- Block slash command usage if the member does not have all required roles
- Block slash command usage if the member has any restricted role
- Enforce submission caps when the modal is submitted
- Return clear ephemeral Discord messages for every blocked case

### Editor updates

- Add role selectors and restriction controls to the command pane
- Add success message editing
- Add explicit save vs sync messaging:
  - `Save draft` stores Convex only
  - `Update Discord command` syncs the saved draft to Discord
- Add warning copy when the published command is out of sync or local edits are unsaved
- Fix pane overlap by tightening width constraints on pane shells and field cards

## Files to change

- `convex/schema.ts`
- `convex/forms.ts`
- `convex/submissions.ts`
- `convex/guilds.ts`
- `convex/discord.ts`
- `convex/http.ts`
- `src/pages/EditForm.tsx`
- `TASK.md`
- `changelog.md`
- `files.md`

## Edge cases

- forms saved before this change must still load cleanly
- a form may reference a role that was deleted after the last refresh
- role cache may be empty until the admin refreshes roles
- required and restricted role lists must not allow duplicate ids
- a member may pass the slash command gate, keep the modal open, and hit the limit before submit
- success messages must stay short enough for Discord content responses
- editor tooltips must not get clipped when overflow fixes are added

## Verification

- `npx convex codegen`
- `npx tsc --noEmit`
- `npm run lint:code`
- Manual check: refresh roles and save role restrictions
- Manual check: required role blocks command open
- Manual check: restricted role blocks command open
- Manual check: lifetime cap blocks submit after the max is reached
- Manual check: daily cap blocks submit after the daily max is reached
- Manual check: success message shows in Discord on successful submit
- Manual check: command pane inputs no longer overlap adjacent panes

## Task completion log

- 2026-04-18 08:39 UTC — PRD created
- 2026-04-18 08:39 UTC — Implemented role cache, role restrictions, submission caps, success message support, and clearer save versus Discord sync warnings in the editor
