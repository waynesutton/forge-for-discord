import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowLeft,
  CaretDown,
  CaretRight,
  CheckCircle,
  CircleNotch,
  Copy,
  Gear,
  Pencil,
  Queue,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { WindowFrame } from "../components/window/WindowFrame";
import { WindowTabs } from "../components/window/WindowTabs";
import { useMe } from "../hooks/useMe";

type LogEntry = FunctionReturnType<typeof api.auditLog.listForForm>[number];

// Display labels for every audit action the app writes. Anything not in
// this map falls back to the raw action string with underscores replaced,
// so new actions show up in the UI without a code change.
const ACTION_LABELS: Record<string, string> = {
  submission_created: "Submitted",
  submission_approved: "Approved",
  submission_denied: "Denied",
  submission_published: "Published to destination",
  mod_queue_posted: "Posted to approval queue",
  mod_queue_channel_missing: "Approval queue channel missing",
  mod_queue_post_failed: "Approval queue post failed",
  publish_text_failed: "Text channel publish failed",
  publish_forum_failed: "Forum publish failed",
  publish_skipped_destination_missing: "Destination channel missing",
  update_published_failed: "Update published message failed",
  archive_thread_failed: "Thread archive failed",
  post_reply_failed: "Reply send failed",
  dm_send_failed: "Submitter DM failed",
  dashboard_reply: "Moderator reply sent",
  ticket_claim: "Ticket claimed",
  ticket_unclaim: "Ticket unclaimed",
  ticket_resolve: "Ticket resolved",
  ticket_reopen: "Ticket reopened",
  ticket_close: "Ticket closed",
  ticket_auto_close: "Ticket auto closed",
};

function formatActionLabel(action: string): string {
  return (
    ACTION_LABELS[action] ??
    action
      .replace(/_/g, " ")
      .replace(/^\w/, (char) => char.toUpperCase())
  );
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

function formatTimestamp(ms: number): string {
  return dateFormatter.format(new Date(ms));
}

// The actor column shows a human-friendly name. Moderator actions store
// the moderator name in metadata; submissions record the Discord user id
// in `actorId` and the display name on the submission doc (surfaced via
// the `submitterName` field on the query result).
function resolveActor(entry: LogEntry): string {
  const metadata = (entry.metadata ?? undefined) as
    | Record<string, unknown>
    | undefined;
  const moderatorName =
    metadata && typeof metadata.moderatorName === "string"
      ? metadata.moderatorName
      : undefined;
  const authorName =
    metadata && typeof metadata.authorName === "string"
      ? metadata.authorName
      : undefined;
  const actorName =
    metadata && typeof metadata.actorName === "string"
      ? metadata.actorName
      : undefined;
  if (moderatorName) return moderatorName;
  if (authorName) return authorName;
  if (actorName) return actorName;
  if (entry.actorId === "system") return "Forge";
  if (entry.submitterName) return entry.submitterName;
  return entry.actorId;
}

// Known Discord REST error codes we want to translate into a one-line fix
// the admin can act on without leaving the page. Keys are Discord's numeric
// `code` field inside the JSON error body; values are short remediation
// messages. See https://discord.com/developers/docs/topics/opcodes-and-status-codes
const DISCORD_ERROR_HINTS: Record<number, string> = {
  10003: "Channel not found. Re-select the channel in form settings.",
  50001:
    "Bot is missing access to this channel. Grant the bot role View Channel, Send Messages, and Embed Links.",
  50013:
    "Bot is missing permissions. Grant the bot role Send Messages and Embed Links on this channel.",
  50035: "Invalid form body rejected by Discord.",
  160002:
    "Forum posts require an active tag. Reselect a forum tag in settings.",
};

// Pulls Discord's `{"code": ..., "message": ...}` out of the `detail` string
// we store (format: `<status>:<body>`). Returns undefined when the detail is
// not a Discord REST error.
function parseDiscordError(
  detail: string | undefined,
): { code: number; message: string; hint?: string } | undefined {
  if (!detail) return undefined;
  const bodyStart = detail.indexOf("{");
  if (bodyStart === -1) return undefined;
  try {
    const parsed = JSON.parse(detail.slice(bodyStart)) as {
      code?: unknown;
      message?: unknown;
    };
    if (typeof parsed.code !== "number") return undefined;
    const message =
      typeof parsed.message === "string" ? parsed.message : "Discord error";
    return {
      code: parsed.code,
      message,
      hint: DISCORD_ERROR_HINTS[parsed.code],
    };
  } catch {
    return undefined;
  }
}

// Short description column. Success rows get a terse summary, error rows
// get a plain-English translation when we recognize the Discord code, and
// otherwise fall back to the raw detail for copy-paste diagnosis.
function summarize(entry: LogEntry): string {
  const metadata = (entry.metadata ?? undefined) as
    | Record<string, unknown>
    | undefined;
  if (entry.severity === "error") {
    const parsed = parseDiscordError(entry.detail);
    if (parsed) {
      return parsed.hint
        ? `${parsed.message}. ${parsed.hint}`
        : `${parsed.message} (code ${parsed.code})`;
    }
    return entry.detail ?? "See details";
  }
  switch (entry.action) {
    case "submission_created": {
      const status =
        metadata && typeof metadata.initialStatus === "string"
          ? metadata.initialStatus
          : "received";
      return `Submission received (${status.replace(/_/g, " ")})`;
    }
    case "submission_approved":
      return "Moderator approved the submission";
    case "submission_denied": {
      const reason =
        metadata && typeof metadata.denyReason === "string"
          ? metadata.denyReason
          : undefined;
      return reason ? `Denied: ${reason}` : "Moderator denied the submission";
    }
    case "submission_published":
      return "Posted to the destination channel";
    case "mod_queue_posted":
      return "Posted to the approval queue channel";
    case "dashboard_reply":
      return "Moderator replied from the dashboard";
    default:
      return formatActionLabel(entry.action);
  }
}

export function FormLogs() {
  const me = useMe();
  const params = useParams();
  const formId = params.formId as Id<"forms"> | undefined;
  const [filter, setFilter] = useState<"all" | "errors">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const form = useQuery(api.forms.get, formId ? { formId } : "skip");
  const entries = useQuery(
    api.auditLog.listForForm,
    formId ? { formId } : "skip",
  );

  const filtered = useMemo(() => {
    if (!entries) return entries;
    if (filter === "errors") {
      return entries.filter((entry) => entry.severity === "error");
    }
    return entries;
  }, [entries, filter]);

  const errorCount = useMemo(() => {
    if (!entries) return 0;
    return entries.filter((entry) => entry.severity === "error").length;
  }, [entries]);

  const handleToggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => {
        setCopied((current) => (current === id ? null : current));
      }, 1500);
    } catch {
      // Clipboard API is best-effort; silently fail rather than throwing
      // a UI error for something the user can work around by selecting
      // the expanded JSON manually.
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to={formId ? `/app/forms/${formId}` : "/app/forms"}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-window)] transition-colors hover:border-[var(--color-ink)]"
            aria-label="Back to form"
          >
            <ArrowLeft size={16} weight="bold" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Form logs</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
              {me.role} workspace
            </p>
          </div>
        </div>

        <Link
          to="/app/settings"
          className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
        >
          <Gear size={16} weight="bold" aria-hidden />
          <span>Settings</span>
        </Link>
      </header>

      <WindowTabs
        tabs={[
          { to: "/app/forms", label: "Forms", active: true },
          { to: "/app/settings", label: "Settings" },
        ]}
      />

      <WindowFrame
        label="forge / forms / logs"
        title={form?.title ? `${form.title} logs` : "Form logs"}
        description="Every submission, decision, and Discord delivery attempt for this form."
        action={
          formId ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/app/forms/${formId}/results`}
                className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
              >
                <Queue size={16} weight="bold" aria-hidden />
                <span>Results</span>
              </Link>
              <Link
                to={`/app/forms/${formId}`}
                className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-2 text-sm font-medium text-[var(--color-surface)] shadow-[var(--shadow-window)]"
              >
                <Pencil size={16} weight="bold" aria-hidden />
                <span>Back to editor</span>
              </Link>
            </div>
          ) : null
        }
      >
        {!formId ? (
          <InlineState
            title="Missing form id"
            description="Open logs from the Forms list or the form editor."
          />
        ) : form === undefined || entries === undefined ? (
          <LoadingState label="Loading logs" />
        ) : form === null ? (
          <InlineState
            title="Form not found"
            description="This form may have been deleted or the link is stale."
          />
        ) : (
          <div className="flex flex-col gap-4">
            <FilterRow
              filter={filter}
              onChange={setFilter}
              totalCount={entries?.length ?? 0}
              errorCount={errorCount}
            />

            {filtered && filtered.length === 0 ? (
              <EmptyLogsState filter={filter} />
            ) : (
              <div className="overflow-hidden rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[color-mix(in_oklab,var(--color-surface-alt,var(--color-surface))_60%,transparent)] text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    <tr>
                      <th className="w-10 px-3 py-3" aria-hidden />
                      <th className="px-3 py-3 font-medium">Time</th>
                      <th className="px-3 py-3 font-medium">Event</th>
                      <th className="px-3 py-3 font-medium">By</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered?.map((entry) => (
                      <LogRow
                        key={entry._id}
                        entry={entry}
                        expanded={Boolean(expanded[entry._id])}
                        copied={copied === entry._id}
                        onToggle={() => handleToggle(entry._id)}
                        onCopy={(text) => handleCopy(entry._id, text)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </WindowFrame>
    </main>
  );
}

function FilterRow({
  filter,
  onChange,
  totalCount,
  errorCount,
}: {
  filter: "all" | "errors";
  onChange: (value: "all" | "errors") => void;
  totalCount: number;
  errorCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        <span>
          {totalCount} {totalCount === 1 ? "entry" : "entries"}
        </span>
        {errorCount > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span className="text-[var(--color-danger)]">
              {errorCount} {errorCount === 1 ? "error" : "errors"}
            </span>
          </>
        ) : null}
      </div>
      <div className="inline-flex items-center gap-1 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        <FilterButton
          active={filter === "all"}
          label="All"
          onClick={() => onChange("all")}
        />
        <FilterButton
          active={filter === "errors"}
          label="Errors"
          onClick={() => onChange("errors")}
        />
      </div>
    </div>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-[calc(var(--radius-window)-4px)] px-3 py-1.5 text-xs font-medium transition-colors " +
        (active
          ? "bg-[var(--color-ink)] text-[var(--color-surface)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-ink)]")
      }
    >
      {label}
    </button>
  );
}

function LogRow({
  entry,
  expanded,
  copied,
  onToggle,
  onCopy,
}: {
  entry: LogEntry;
  expanded: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
}) {
  const isError = entry.severity === "error";
  const actor = resolveActor(entry);
  const actionLabel = formatActionLabel(entry.action);
  const summary = summarize(entry);
  // Pretty JSON for the expanded view. Falls back to an empty object so
  // the copy button still produces valid JSON if metadata is missing.
  const metadataJson = useMemo(
    () => JSON.stringify(entry.metadata ?? {}, null, 2),
    [entry.metadata],
  );
  const copyPayload = entry.detail ?? metadataJson;

  return (
    <>
      <tr
        className={
          "border-t border-[var(--color-border)] " +
          (isError
            ? "bg-[color-mix(in_oklab,var(--color-danger)_8%,transparent)]"
            : "")
        }
      >
        <td className="px-3 py-3 align-top">
          <button
            type="button"
            onClick={onToggle}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-border)] hover:text-[var(--color-ink)]"
            aria-expanded={expanded}
            aria-label={expanded ? "Hide details" : "Show details"}
          >
            {expanded ? (
              <CaretDown size={14} weight="bold" />
            ) : (
              <CaretRight size={14} weight="bold" />
            )}
          </button>
        </td>
        <td className="px-3 py-3 align-top font-mono text-xs text-[var(--color-muted)]">
          {formatTimestamp(entry._creationTime)}
        </td>
        <td className="px-3 py-3 align-top text-[var(--color-ink)]">
          {actionLabel}
        </td>
        <td className="px-3 py-3 align-top text-[var(--color-muted)]">
          {actor}
        </td>
        <td className="px-3 py-3 align-top">
          <StatusBadge severity={entry.severity} />
        </td>
        <td className="px-3 py-3 align-top text-[var(--color-ink)]">
          {summary}
        </td>
      </tr>
      {expanded ? (
        <tr className="border-t border-[var(--color-border)]">
          <td />
          <td colSpan={5} className="px-3 py-3">
            <div className="flex flex-col gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface-alt,var(--color-surface))_55%,transparent)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  {isError ? "Error detail" : "Metadata"}
                </span>
                <button
                  type="button"
                  onClick={() => onCopy(copyPayload)}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
                >
                  {copied ? (
                    <CheckCircle size={12} weight="bold" />
                  ) : (
                    <Copy size={12} weight="bold" />
                  )}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--color-ink)]">
                {isError && entry.detail ? entry.detail : metadataJson}
              </pre>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function StatusBadge({ severity }: { severity: "info" | "error" }) {
  if (severity === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-danger)] bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]">
        <XCircle size={12} weight="fill" />
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs font-medium text-[var(--color-ink)]">
      <CheckCircle size={12} weight="fill" />
      Success
    </span>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-[var(--color-muted)]">
      <CircleNotch size={18} weight="bold" className="animate-spin" />
      <span>{label}</span>
    </div>
  );
}

function InlineState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-window)] border border-[color-mix(in_oklab,var(--color-danger)_35%,var(--color-border))] bg-[var(--color-surface)] px-4 py-3">
      <Warning size={18} weight="fill" className="mt-0.5 text-[var(--color-danger)]" />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
        <p className="text-sm text-[var(--color-muted)]">{description}</p>
      </div>
    </div>
  );
}

function EmptyLogsState({ filter }: { filter: "all" | "errors" }) {
  return (
    <div className="rounded-[var(--radius-window)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10 text-center">
      <p className="text-sm font-medium text-[var(--color-ink)]">
        {filter === "errors"
          ? "No errors recorded"
          : "No log entries yet"}
      </p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {filter === "errors"
          ? "Every Discord delivery has succeeded so far for this form."
          : "Submissions, approvals, and delivery attempts will show up here."}
      </p>
    </div>
  );
}
