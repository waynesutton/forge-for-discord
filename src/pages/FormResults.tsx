import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CheckCircle,
  ChatCircle,
  CircleNotch,
  ClockClockwise,
  Copy,
  Eye,
  EyeSlash,
  FileCsv,
  FilePdf,
  Gear,
  Queue,
  Trash,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import { WindowFrame } from "../components/window/WindowFrame";
import { WindowTabs } from "../components/window/WindowTabs";
import { useMe } from "../hooks/useMe";
import { downloadSubmissionsCsv, downloadSubmissionsPdf } from "../lib/exportResults";

type FormDoc = NonNullable<FunctionReturnType<typeof api.forms.get>>;
type SubmissionRow = FunctionReturnType<
  typeof api.submissions.listForForm
>[number];
type StatusLabel = SubmissionRow["status"];

type DeleteTarget = {
  submissionId: Id<"submissions">;
  submitterName: string;
  hasModQueueMessage: boolean;
  hasPublishedMessage: boolean;
};

type DenyTarget = {
  submissionId: Id<"submissions">;
  submitterName: string;
};

export function FormResults() {
  const me = useMe();
  const params = useParams();
  const formId = params.formId as Id<"forms"> | undefined;
  const [includeHidden, setIncludeHidden] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<"csv" | "pdf" | null>(null);
  const [rowBusyId, setRowBusyId] = useState<Id<"submissions"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [denyTarget, setDenyTarget] = useState<DenyTarget | null>(null);

  const form = useQuery(api.forms.get, formId ? { formId } : "skip");
  const submissions = useQuery(
    api.submissions.listForForm,
    formId ? { formId, includeHidden } : "skip",
  );
  const setHidden = useMutation(api.submissions.setHidden);
  const deleteSubmission = useMutation(api.submissions.deleteSubmission);
  const decideSubmission = useMutation(api.submissions.decide);
  const postReply = useMutation(api.submissions.postReply);

  const canExport =
    !!form && Array.isArray(submissions) && submissions.length > 0;

  const handleExport = async (kind: "csv" | "pdf") => {
    if (!form || !submissions || submissions.length === 0) return;
    setExportError(null);
    setBusyKind(kind);
    try {
      if (kind === "csv") {
        downloadSubmissionsCsv(form, submissions);
      } else {
        await downloadSubmissionsPdf(form, submissions);
      }
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Export failed. Try again.",
      );
    } finally {
      setBusyKind(null);
    }
  };

  const handleToggleHidden = async (row: SubmissionRow) => {
    setActionError(null);
    setRowBusyId(row._id);
    try {
      await setHidden({
        submissionId: row._id,
        hidden: row.hiddenAt === undefined,
      });
    } catch (err) {
      setActionError(formatMutationError(err));
    } finally {
      setRowBusyId(null);
    }
  };

  const handleApprove = async (row: SubmissionRow) => {
    if (row.status !== "pending") return;
    setActionError(null);
    setRowBusyId(row._id);
    try {
      const result = await decideSubmission({
        submissionId: row._id,
        decision: "approved",
      });
      if (result.alreadyDecided) {
        setActionError(
          result.decidedByName
            ? `Already handled by ${result.decidedByName}.`
            : "This submission was already decided.",
        );
      }
    } catch (err) {
      setActionError(formatMutationError(err));
    } finally {
      setRowBusyId(null);
    }
  };

  const handleConfirmDeny = async (reason: string) => {
    if (!denyTarget) return;
    setActionError(null);
    setRowBusyId(denyTarget.submissionId);
    try {
      const result = await decideSubmission({
        submissionId: denyTarget.submissionId,
        decision: "denied",
        denyReason: reason,
      });
      if (result.alreadyDecided) {
        setActionError(
          result.decidedByName
            ? `Already handled by ${result.decidedByName}.`
            : "This submission was already decided.",
        );
      }
      setDenyTarget(null);
    } catch (err) {
      setActionError(formatMutationError(err));
    } finally {
      setRowBusyId(null);
    }
  };

  const handlePostReply = async (
    row: SubmissionRow,
    body: string,
  ): Promise<string | null> => {
    setActionError(null);
    setRowBusyId(row._id);
    try {
      await postReply({ submissionId: row._id, body });
      return null;
    } catch (err) {
      const message = formatMutationError(err);
      setActionError(message);
      return message;
    } finally {
      setRowBusyId(null);
    }
  };

  const handleConfirmDelete = async (deleteFromDiscord: boolean) => {
    if (!deleteTarget) return;
    setActionError(null);
    setRowBusyId(deleteTarget.submissionId);
    try {
      await deleteSubmission({
        submissionId: deleteTarget.submissionId,
        deleteFromDiscord,
      });
      setDeleteTarget(null);
    } catch (err) {
      setActionError(formatMutationError(err));
    } finally {
      setRowBusyId(null);
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
            <h1 className="text-xl font-semibold tracking-tight">Form results</h1>
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
        label="forge / forms / results"
        title={form?.title ? `${form.title} results` : "Form results"}
        description="Review every submission connected to this form in one place."
        action={
          formId ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport("csv")}
                disabled={!canExport || busyKind !== null}
                title="Download all submissions as a CSV spreadsheet"
                className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyKind === "csv" ? (
                  <CircleNotch size={16} weight="bold" className="animate-spin" aria-hidden />
                ) : (
                  <FileCsv size={16} weight="bold" aria-hidden />
                )}
                <span>Download CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport("pdf")}
                disabled={!canExport || busyKind !== null}
                title="Download all submissions as a PDF report"
                className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyKind === "pdf" ? (
                  <CircleNotch size={16} weight="bold" className="animate-spin" aria-hidden />
                ) : (
                  <FilePdf size={16} weight="bold" aria-hidden />
                )}
                <span>Download PDF</span>
              </button>
              <Link
                to={`/app/forms/${formId}/logs`}
                className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
              >
                <ClockClockwise size={16} weight="bold" aria-hidden />
                <span>Logs</span>
              </Link>
              <Link
                to={`/app/forms/${formId}`}
                className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-2 text-sm font-medium text-[var(--color-surface)] shadow-[var(--shadow-window)]"
              >
                <Queue size={16} weight="bold" aria-hidden />
                <span>Back to editor</span>
              </Link>
            </div>
          ) : null
        }
      >
        {!formId ? (
          <InlineState
            title="Missing form id"
            description="Open results from the Forms list or the form editor."
          />
        ) : form === undefined || submissions === undefined ? (
          <LoadingState label="Loading results" />
        ) : form === null ? (
          <InlineState
            title="Form not found"
            description="This form may have been deleted or the link is stale."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {exportError ? (
              <InlineState title="Export failed" description={exportError} />
            ) : null}
            {actionError ? (
              <InlineState title="Action failed" description={actionError} />
            ) : null}

            <SummaryBar
              count={submissions.length}
              includeHidden={includeHidden}
              onToggleHidden={() => setIncludeHidden((current) => !current)}
            />

            {submissions.length === 0 ? (
              <EmptyResultsState
                formTitle={form.title}
                includeHidden={includeHidden}
              />
            ) : (
              <ul className="flex flex-col gap-4">
                {submissions.map((submission) => (
                  <SubmissionCard
                    key={submission._id}
                    submission={submission}
                    form={form}
                    isBusy={rowBusyId === submission._id}
                    onToggleHidden={() => handleToggleHidden(submission)}
                    onApprove={() => handleApprove(submission)}
                    onRequestDeny={() =>
                      setDenyTarget({
                        submissionId: submission._id,
                        submitterName: submission.submitterName,
                      })
                    }
                    onRequestDelete={() =>
                      setDeleteTarget({
                        submissionId: submission._id,
                        submitterName: submission.submitterName,
                        hasModQueueMessage: submission.hasModQueueMessage,
                        hasPublishedMessage: submission.hasPublishedMessage,
                      })
                    }
                    onPostReply={(body) => handlePostReply(submission, body)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </WindowFrame>

      {deleteTarget ? (
        <ConfirmDeleteDialog
          target={deleteTarget}
          isBusy={rowBusyId === deleteTarget.submissionId}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

      {denyTarget ? (
        <DenySubmissionDialog
          target={denyTarget}
          isBusy={rowBusyId === denyTarget.submissionId}
          onCancel={() => setDenyTarget(null)}
          onConfirm={handleConfirmDeny}
        />
      ) : null}
    </main>
  );
}

function SummaryBar({
  count,
  includeHidden,
  onToggleHidden,
}: {
  count: number;
  includeHidden: boolean;
  onToggleHidden: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
          {count} {count === 1 ? "submission" : "submissions"}
        </span>
        <span className="text-sm text-[var(--color-muted)]">
          Newest submissions appear first.
        </span>
      </div>
      <button
        type="button"
        onClick={onToggleHidden}
        title={includeHidden ? "Hide the soft-hidden rows" : "Show soft-hidden rows"}
        className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
      >
        {includeHidden ? (
          <EyeSlash size={14} weight="bold" aria-hidden />
        ) : (
          <Eye size={14} weight="bold" aria-hidden />
        )}
        <span>{includeHidden ? "Hide hidden" : "Show hidden"}</span>
      </button>
    </div>
  );
}

function SubmissionCard({
  submission,
  form,
  isBusy,
  onToggleHidden,
  onApprove,
  onRequestDeny,
  onRequestDelete,
  onPostReply,
}: {
  submission: SubmissionRow;
  form: FormDoc;
  isBusy: boolean;
  onToggleHidden: () => void;
  onApprove: () => void;
  onRequestDeny: () => void;
  onRequestDelete: () => void;
  onPostReply: (body: string) => Promise<string | null>;
}) {
  const fieldsById = useMemo(() => {
    const map = new Map<string, FormDoc["fields"][number]>();
    for (const field of form.fields) {
      map.set(field.id, field);
    }
    return map;
  }, [form.fields]);

  const orderedFieldIds = useMemo(() => {
    const fromSchema = form.fields.map((field) => field.id);
    const extra = Object.keys(submission.values).filter(
      (id) => !fieldsById.has(id),
    );
    return [...fromSchema, ...extra];
  }, [form.fields, fieldsById, submission.values]);

  const isHidden = submission.hiddenAt !== undefined;

  return (
    <li
      className={`rounded-[var(--radius-window)] border bg-[var(--color-bg)] p-5 transition-colors ${
        isHidden
          ? "border-dashed border-[var(--color-border)] opacity-70"
          : "border-[var(--color-border)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-[var(--color-ink)]">
              {submission.submitterName}
            </p>
            {isHidden ? <HiddenBadge /> : null}
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Submitted {formatTimestamp(submission.submittedAt)}
            {submission.decidedAt ? (
              <>
                <span className="mx-1.5 text-[var(--color-border)]">•</span>
                {submission.status === "denied" ? "Denied" : "Approved"}{" "}
                {formatTimestamp(submission.decidedAt)}
                {submission.decidedBy ? ` by ${submission.decidedBy}` : ""}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={submission.status} />
          {form.requiresApproval && submission.status === "pending" ? (
            <>
              <RowAction
                icon={<CheckCircle size={14} weight="bold" aria-hidden />}
                label="Approve"
                title="Approve this submission. Posts to the destination channel and notifies the submitter."
                onClick={onApprove}
                disabled={isBusy}
                variant="primary"
              />
              <RowAction
                icon={<XCircle size={14} weight="bold" aria-hidden />}
                label="Deny"
                title="Deny this submission with a reason. Notifies the submitter via DM."
                onClick={onRequestDeny}
                disabled={isBusy}
                variant="danger"
              />
            </>
          ) : null}
          <RowAction
            icon={
              isHidden ? (
                <Eye size={14} weight="bold" aria-hidden />
              ) : (
                <EyeSlash size={14} weight="bold" aria-hidden />
              )
            }
            label={isHidden ? "Unhide" : "Hide"}
            title={
              isHidden
                ? "Show this submission in the default view"
                : "Hide this submission from the default view. Discord messages stay."
            }
            onClick={onToggleHidden}
            disabled={isBusy}
          />
          <RowAction
            icon={<Trash size={14} weight="bold" aria-hidden />}
            label="Delete"
            title="Permanently delete this submission from the dashboard."
            onClick={onRequestDelete}
            disabled={isBusy}
            variant="danger"
          />
        </div>
      </div>

      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        {orderedFieldIds.map((fieldId) => {
          const value = submission.values[fieldId];
          if (value === undefined) return null;
          const field = fieldsById.get(fieldId);
          return (
            <FieldBlock
              key={fieldId}
              label={field?.label || fieldId}
              value={value}
              field={field}
            />
          );
        })}
      </dl>

      {submission.denyReason ? (
        <div className="mt-4 rounded-[calc(var(--radius-window)-2px)] border border-[color-mix(in_oklab,var(--color-danger)_35%,var(--color-border))] bg-[var(--color-surface)] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
            Deny reason
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--color-ink)]">
            {submission.denyReason}
          </p>
        </div>
      ) : null}

      {form.ticketMode && submission.ticketStatus ? (
        <TicketSummaryRow submission={submission} />
      ) : null}

      {submission.hasPublishedMessage ? (
        <ReplyBox onPost={onPostReply} isBusy={isBusy} />
      ) : null}
    </li>
  );
}

// Small informational row that shows the current ticket state and
// assignee next to the submission card. Only rendered when the form
// has ticket mode enabled, so non-ticket workflows look identical to
// before.
function TicketSummaryRow({ submission }: { submission: SubmissionRow }) {
  const status = submission.ticketStatus ?? "open";
  const statusLabel =
    status === "in_progress"
      ? "In progress"
      : status === "resolved"
        ? "Resolved"
        : status === "closed"
          ? "Closed"
          : "Open";
  const assignee = submission.assignedToUserName?.trim();

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[calc(var(--radius-window)-2px)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-muted)]">
      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-[var(--color-ink)]">
        {statusLabel}
      </span>
      <span>
        {assignee
          ? `Assigned to ${assignee}`
          : "Unassigned. Moderators can claim from Discord."}
      </span>
    </div>
  );
}

// Collapsed-by-default reply composer. Dashboard mods use this to post
// into the same Discord thread/channel as the published submission
// without leaving Forge. Limited to 1800 characters so the Discord
// content budget (2000) has headroom for the "via dashboard" prefix.
function ReplyBox({
  onPost,
  isBusy,
}: {
  onPost: (body: string) => Promise<string | null>;
  isBusy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSend = body.trim().length > 0 && body.length <= 1800;

  const reset = () => {
    setOpen(false);
    setBody("");
    setError(null);
  };

  const handleSend = async () => {
    setError(null);
    const message = await onPost(body.trim());
    if (message) {
      setError(message);
      return;
    }
    reset();
  };

  if (!open) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
          title="Post a reply into the Discord channel or thread for this submission"
        >
          <ChatCircle size={14} weight="bold" aria-hidden />
          <span>Reply in Discord</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-[calc(var(--radius-window)-2px)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <label className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
        Reply in Discord
      </label>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={1800}
        placeholder="Your reply will be posted by the bot and prefixed with your name."
        className="w-full resize-y rounded-[calc(var(--radius-window)-4px)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-[var(--color-muted)]">
          {body.length} / 1800
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={isBusy}
            className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-muted)] transition-colors hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || isBusy}
            className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-surface)] shadow-[var(--shadow-window)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? (
              <CircleNotch size={12} weight="bold" className="animate-spin" aria-hidden />
            ) : (
              <ChatCircle size={12} weight="bold" aria-hidden />
            )}
            <span>Post reply</span>
          </button>
        </div>
      </div>
      {error ? (
        <p className="text-xs text-[var(--color-danger)]">{error}</p>
      ) : null}
    </div>
  );
}

function FieldBlock({
  label,
  value,
  field,
}: {
  label: string;
  value: string;
  field?: FormDoc["fields"][number];
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context, browser policy). Fail silently;
      // the user can still select and copy by hand.
    }
  };

  const type = field?.type ?? "short";
  const isOptionField =
    type === "select" || type === "yes_no" || type === "checkbox";
  const displayValue = isOptionField
    ? (field?.options?.find((option) => option.id === value)?.label ?? value)
    : type === "number"
      ? formatNumericAnswer(value, field?.currencyUnit)
      : value;
  const isCode = type === "code";

  return (
    <div
      className={
        isCode
          ? "group relative rounded-[calc(var(--radius-window)-2px)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 md:col-span-2"
          : "group relative rounded-[calc(var(--radius-window)-2px)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
          {label}
        </dt>
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? "Copied" : "Copy value"}
          className={
            isCode
              ? "flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
              : "flex h-6 w-6 items-center justify-center rounded-full border border-transparent text-[var(--color-muted)] opacity-0 transition-all hover:border-[var(--color-border)] hover:text-[var(--color-ink)] focus-visible:opacity-100 group-hover:opacity-100"
          }
          aria-label="Copy value"
        >
          <Copy size={12} weight="bold" aria-hidden />
        </button>
      </div>
      {isCode ? (
        <dd className="mt-2">
          <pre className="max-h-96 overflow-auto rounded-[calc(var(--radius-window)-4px)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_85%,black)] px-3 py-3 text-xs leading-relaxed text-[var(--color-ink)]">
            <code className="font-mono whitespace-pre">{displayValue}</code>
          </pre>
        </dd>
      ) : (
        <dd className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--color-ink)]">
          {displayValue}
        </dd>
      )}
      {copied ? (
        <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
          Copied
        </span>
      ) : null}
    </div>
  );
}

function RowAction({
  icon,
  label,
  title,
  onClick,
  disabled,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
  variant?: "default" | "danger" | "primary";
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-[var(--radius-window)] border px-2.5 py-1.5 text-xs font-medium uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const variantClass =
    variant === "danger"
      ? "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-danger)] hover:border-[var(--color-danger)]"
      : variant === "primary"
        ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-surface)] shadow-[var(--shadow-window)] hover:opacity-90"
        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-ink)]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${variantClass}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ConfirmDeleteDialog({
  target,
  isBusy,
  onCancel,
  onConfirm,
}: {
  target: DeleteTarget;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: (deleteFromDiscord: boolean) => void;
}) {
  const [alsoDeleteDiscord, setAlsoDeleteDiscord] = useState(false);
  const hasAnyDiscordMessage =
    target.hasModQueueMessage || target.hasPublishedMessage;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-window)]">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            Delete submission from {target.submitterName}?
          </h2>
          <p className="text-sm text-[var(--color-muted)]">
            This removes the row from Forge permanently. By default, the
            Discord messages stay where they are so the channel history is
            preserved.
          </p>
        </div>

        <label
          className={`flex items-start gap-3 rounded-[calc(var(--radius-window)-2px)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-3 text-sm ${
            hasAnyDiscordMessage ? "" : "opacity-60"
          }`}
        >
          <input
            type="checkbox"
            checked={alsoDeleteDiscord}
            onChange={(event) => setAlsoDeleteDiscord(event.target.checked)}
            disabled={!hasAnyDiscordMessage || isBusy}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-1">
            <span className="font-medium text-[var(--color-ink)]">
              Also remove from Discord
            </span>
            <span className="text-xs text-[var(--color-muted)]">
              {hasAnyDiscordMessage
                ? "Deletes the mod queue embed and the destination message if Forge posted them."
                : "No Discord messages recorded for this submission."}
            </span>
          </span>
        </label>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(alsoDeleteDiscord)}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-danger)] bg-[var(--color-danger)] px-3 py-2 text-sm font-medium text-[var(--color-surface)] transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? (
              <CircleNotch size={14} weight="bold" className="animate-spin" aria-hidden />
            ) : (
              <Trash size={14} weight="bold" aria-hidden />
            )}
            <span>Delete submission</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DenySubmissionDialog({
  target,
  isBusy,
  onCancel,
  onConfirm,
}: {
  target: DenyTarget;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 500 && !isBusy;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-window)]">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            Deny submission from {target.submitterName}?
          </h2>
          <p className="text-sm text-[var(--color-muted)]">
            The submitter receives this reason in a DM. The mod queue embed
            updates so other admins can see it was denied.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Deny reason
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={4}
            disabled={isBusy}
            placeholder="Explain why this submission was denied."
            className="rounded-[calc(var(--radius-window)-2px)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none"
          />
          <span className="text-xs text-[var(--color-muted)]">
            {trimmed.length}/500 characters
          </span>
        </label>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(trimmed)}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-danger)] bg-[var(--color-danger)] px-3 py-2 text-sm font-medium text-[var(--color-surface)] transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? (
              <CircleNotch size={14} weight="bold" className="animate-spin" aria-hidden />
            ) : (
              <XCircle size={14} weight="bold" aria-hidden />
            )}
            <span>Deny submission</span>
          </button>
        </div>
      </div>
    </div>
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

function EmptyResultsState({
  formTitle,
  includeHidden,
}: {
  formTitle: string;
  includeHidden: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-window)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-8">
      <h3 className="text-base font-semibold">
        {includeHidden
          ? `No submissions for ${formTitle}`
          : `No visible submissions for ${formTitle}`}
      </h3>
      <p className="max-w-xl text-sm text-[var(--color-muted)]">
        {includeHidden
          ? "Once members submit this form in Discord, their answers will show up here."
          : "Every current submission is hidden. Toggle Show hidden to review them."}
      </p>
    </div>
  );
}

function HiddenBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
      <EyeSlash size={10} weight="bold" aria-hidden />
      Hidden
    </span>
  );
}

function StatusBadge({ status }: { status: StatusLabel }) {
  const className =
    status === "approved" || status === "auto_published"
      ? "border-[color-mix(in_oklab,var(--color-success)_35%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-success)_10%,var(--color-surface))] text-[var(--color-success)]"
      : status === "denied"
        ? "border-[color-mix(in_oklab,var(--color-danger)_35%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-danger)_8%,var(--color-surface))] text-[var(--color-danger)]"
        : "border-[color-mix(in_oklab,var(--color-warning)_35%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-warning)_10%,var(--color-surface))] text-[var(--color-ink)]";

  const label =
    status === "auto_published"
      ? "Auto published"
      : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.2em] ${className}`}
    >
      {label}
    </span>
  );
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

// Render a stored numeric answer with thousands grouping and the optional
// currency unit label the admin configured. Falls back to the raw value
// if the string is not a valid number so old rows still display something.
function formatNumericAnswer(raw: string, unit?: string) {
  if (!raw) return "";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return raw;
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 20,
  }).format(parsed);
  const trimmedUnit = unit?.trim();
  return trimmedUnit ? `${formatted} ${trimmedUnit}` : formatted;
}

function formatMutationError(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message;
    if (message.includes("deny_reason_required")) {
      return "Add a reason before denying this submission.";
    }
    if (message.includes("deny_reason_too_long")) {
      return "Deny reason must be 500 characters or fewer.";
    }
    if (message.includes("submission_not_found")) {
      return "This submission no longer exists. Refresh to reload.";
    }
    if (message.includes("access_denied")) {
      return "You do not have permission to run this action.";
    }
    return message;
  }
  return "Something went wrong. Try again.";
}
