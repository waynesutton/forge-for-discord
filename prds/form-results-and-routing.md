Created: 2026-04-18 08:20 UTC
Last Updated: 2026-04-18 08:20 UTC
Status: Done

# Form results and routing

## Problem

Forge can create and publish forms, but admins still cannot do three core jobs:

1. review submissions for a specific form in a dedicated results view
2. refresh and browse Discord channels for each connected server
3. configure where a form should route submissions when approval is on or off

The current schema already hints at routing on `forms`, but the editor does not expose it and Settings does not help admins sync channel choices from Discord.

## Proposed solution

Ship one narrow slice that connects results, routing, and channel sync without jumping ahead into the full moderation system.

### Results

- Add a dedicated route at `/app/forms/:formId/results`
- Back it with a `submissions` query scoped to one form
- Show newest submissions first with status, submitter, created time, and submitted values

### Channel sync

- Add a cached `guildChannels` table
- Add a Discord action to refresh channels for one connected guild
- Store supported channels and forum tags in Convex so Settings and the form editor can use reactive queries instead of ad hoc fetch calls

### Server level routing setup

- Extend guild settings with default mod queue and default destination channel values
- Let admins refresh channels for each connected server from Settings
- Let admins save defaults per guild after channels are synced

### Form level routing

- Extend `forms.update` so the form editor can save:
  - `modQueueChannelId`
  - `destinationChannelId`
  - `destinationType`
  - `forumTagId`
- Default new forms from guild level routing when available
- Add routing controls to the editor using cached channel options

### Editor follow through

- Add the missing routing controls inside the form editor workspace
- Add a direct `Results` entry point from the forms list and the form editor

## Files to change

- `convex/schema.ts`
- `convex/guilds.ts`
- `convex/forms.ts`
- `convex/discord.ts`
- `convex/submissions.ts`
- `src/App.tsx`
- `src/pages/EditForm.tsx`
- `src/pages/Forms.tsx`
- `src/pages/Settings.tsx`
- `TASK.md`
- `changelog.md`
- `files.md`

## New files

- `src/pages/FormResults.tsx`

## Edge cases

- A guild may have no cached channels yet
- A server refresh may fail even though the guild is connected
- A previously selected channel may disappear from Discord after a refresh
- Forum tags must only be selectable when the destination channel is a forum channel
- Approval queue and destination channel must stay optional until the admin configures them
- Results view must handle empty submissions cleanly
- Long submission values should wrap without breaking the page

## Verification

- `npx tsc --noEmit`
- `npm run lint:code`
- Manual check: refresh channels from Settings for a connected server
- Manual check: save guild routing defaults
- Manual check: save form level routing from the editor
- Manual check: open `/app/forms/:formId/results` and review submissions

## Task completion log

- 2026-04-18 08:20 UTC — PRD created
- 2026-04-18 08:20 UTC — Implemented cached guild channel sync, routing defaults, form level routing controls, and the per form results route
