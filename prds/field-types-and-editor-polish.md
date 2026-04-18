# Field types and editor polish

## Problem

Forms today only support two field types (short and paragraph). Admins
want email capture, dropdowns, yes/no, confirmation checkboxes, and code
blocks. The Command settings pane has its save actions only at the top of
a tall column, so admins scroll twice to save. The modal field rows have
no explicit affordance that a click edits them. Long strings pass through
the app untouched, so a malicious submitter could paste HTML or script
fragments into the Discord embed or the dashboard.

## Proposed solution

One slice that keeps it simple, does not rework Phase 3 routing, and
lands cleanly on top of today's editor.

### New field types

The Discord modal limit is 5 components. Keep that cap. Add these types
alongside `short` and `paragraph`:

- `email` — text input (short). Server-side email regex on submit. Label
  description reads "For contact only, not shown on the form".
- `code` — text input (paragraph). Rendered in Discord embeds wrapped in
  a triple backtick fenced block. Rendered in dashboard with a monospace
  `<pre>` plus a copy button.
- `select` — Discord String Select inside a Label component. Admin picks
  the options in the editor (id + label).
- `yes_no` — Discord String Select with fixed Yes/No options. No options
  editor in the form builder.
- `checkbox` — Discord String Select with a single required option (the
  admin writes the confirmation text, e.g. "I agree"). Acts as a forced
  confirmation.

New optional fields on a form field: `helperText: string` and
`options: Array<{ id: string, label: string }>`. Neither is required for
existing types.

### Discord modal build

If every field is `short | paragraph | email | code`, keep the classic
modal shape (ACTION_ROW -> TEXT_INPUT) for maximum compatibility. If any
field is `select | yes_no | checkbox`, switch the whole modal to the
Label-wrapped shape so every input sits inside a `type 18` Label, which
Discord supports for modals and has for over a year.

Label mode lets us put "Must be 5 to 100 characters" and "For contact
only" text in the Label `description`, answering the min/max hint ask.

### Modal submit parsing

Extend `collectModalValues` in `convex/http.ts` to pull both
`value: string` (text inputs) and `values: string[]` (string selects).
For string selects we store the first selected value.

### Submission validation and sanitization

New helper `sanitizeSubmissionValue` and per-field `validateFieldValue`:

- Strip HTML tags (`<[^>]+>`), zero-width characters, and null bytes.
- Collapse excessive whitespace.
- Enforce `required`, `minLength`, `maxLength` on every field.
- For `email`, require a basic RFC-5322-ish regex match.
- For `select` and `yes_no`, require the value to match an option id.
- For `checkbox`, require the value to match the single option id.

Validation runs in `insertFromDiscord` before anything else. Any failure
throws a `ConvexError` with a code so the HTTP handler returns an
ephemeral error to the submitter.

### Code field rendering

- Discord embed field value: triple backticks, with language hint if the
  admin set `helperText` to something like `ts`. Otherwise plain fence.
  Escape existing backticks by replacing with a visually similar char
  sequence that will not terminate the fence.
- Dashboard results card: render code field values inside a `<pre><code>`
  block with a copy button, wrapping long lines.
- CSV and PDF export: unchanged. Code values still serialize as text.

### Editor UI

- Field type selector expands from 2 options to 7. Each option gets a
  Phosphor icon.
- When the selected type is `select` or `checkbox`, show an inline
  options editor. When it is `yes_no`, show a static "Yes / No" preview.
- New "Helper text" input under Placeholder. Shown in Discord via the
  Label description, and in the builder preview.
- New `PencilSimple` edit icon on the left of each field row. Click the
  icon or the row itself to toggle the editor, same as today.
- Add a Save draft button at the bottom of the Modal fields pane. Same
  handler as the top save. No new state.
- Add Save draft + Update Discord command buttons at the bottom of the
  Command settings pane. Same handlers. Visible only when the top
  buttons would be visible.
- If `requiresApproval` is on, move the Moderator roles picker to the
  top of the Access and submission rules section and add a small hint
  that these roles can approve or deny.

### Docs

- Update `changelog.md`, `files.md`, `TASK.md` once the feature lands.

## Files to change

- `convex/schema.ts` — extend field validator.
- `convex/forms.ts` — update `formFieldValidator`, `editableFormValidator`,
  `modalFormValidator`, and the field validation inside `update`.
- `convex/submissions.ts` — add `sanitizeValue`, `validateFieldValue`, and
  run them in `insertFromDiscord`.
- `convex/http.ts` — rewrite the `APPLICATION_COMMAND` branch to build
  either classic or Label modal, and extend `collectModalValues` to
  handle string selects.
- `convex/discord.ts` — code block formatting when building the
  submission embed (`buildSubmissionEmbed`).
- `src/pages/EditForm.tsx` — new field types, options editor, helper
  text input, edit icon, bottom save buttons, moderator roles emphasis.
- `src/pages/FormResults.tsx` — `<pre>` block for code values plus copy.

## Edge cases

- Old forms already published with only text fields: classic modal shape
  keeps working, no re-publish required.
- A form gets a new select field but the admin never sets options: the
  form editor blocks save with a clear error. The Discord publish path
  does not open a modal with an empty select.
- A submitter clears an optional text field: stored as an empty string,
  which the embed renders as an em space so the field still appears.
- An approver approves a submission with code content: embed renders
  with fenced code; Discord's native copy icon handles clipboard.
- Values with markdown-looking characters (`*`, `_`, backticks): still
  escaped via the existing `escapeMarkdown` before posting.
- Modal with 5 text fields and also a select: still 5 components max, so
  the editor cap stays at 5.

## Verification

- Build a form with one of each type. Publish it. Run the slash command
  in a test guild. Each input renders correctly in Discord.
- Submit valid and invalid values for each type. Invalid values bounce
  with an ephemeral error.
- Approve a submission and confirm the embed, DM, and results page all
  render the new fields with labels and formatted code blocks.
- CSV and PDF exports contain the new values.
- `npx tsc --noEmit` and `npm run lint:code` pass.

## Out of scope

- File uploads.
- Conditional fields.
- Multi-select (always single value).
- Diffs.com rendering (a future slice if syntax highlighting is needed).
- Reordering fields beyond the existing arrow buttons.
