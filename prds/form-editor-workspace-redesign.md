# Form editor workspace redesign

## Problem

The current `/app/forms/:formId` editor works, but it still feels like a long settings page.

The biggest issues:

- The three core areas `Command settings`, `Modal fields`, and `Discord preview` do not behave like a workspace
- The layout only becomes three columns at very large widths, then collapses into a long vertical form
- There is no way to hide a pane to get more room for the current task
- Mobile does not adapt the editor into a focused single pane flow
- Important controls have no tooltips, so newer users do not know what each action changes
- The visual system is serviceable but not yet distinctive or dense enough for a serious builder UI

## Proposed solution

Redesign `EditForm` into a responsive builder workspace with pane controls.

### Workspace behavior

- Add a compact workspace toolbar near the top of the editor
- Use Phosphor icons for each pane and for layout controls
- Let the user toggle `Command settings`, `Modal fields`, and `Discord preview`
- Support one, two, or three visible panes
- Prevent the user from hiding all panes
- Persist pane visibility and the active mobile pane in local storage

### Desktop and tablet layout

- When three panes are visible, render a dense three column builder layout
- When two panes are visible, render a two column layout with more room
- When one pane is visible, let that pane take the full width
- Keep the status and action controls visible without adding extra chrome

### Mobile layout

- Show one active pane at a time with a segmented pane switcher
- Keep save and publish controls visible and easy to reach
- Do not hide core functionality on mobile

### UI refinements

- Give each pane a stronger identity with icons, badges, and better hierarchy
- Add custom tooltips for pane toggles and key controls
- Make the preview feel closer to a Discord modal
- Add a small publish readiness summary so users know why publish is blocked

## Files to change

- `src/pages/EditForm.tsx`
- `src/styles/index.css`
- `TASK.md`
- `changelog.md`
- `files.md`

## New files

- `src/components/ui/Tooltip.tsx`

## Edge cases

- If the user hides two panes, the last pane must stay visible
- If local storage contains an invalid pane state, fall back to all panes visible
- On mobile, if the active pane becomes hidden, switch to the first visible pane
- Tooltips must not block keyboard use
- Publish and save behavior must remain unchanged
- The layout must still work when there are zero fields or very long field labels

## Verification

- `npx tsc --noEmit`
- `npm run lint:code`
- Manual check for desktop, tablet width, and mobile width
- Manual check that pane toggles support one, two, and three pane states
- Manual check that tooltips render and do not trap focus
