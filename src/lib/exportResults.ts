import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

type FormDoc = NonNullable<FunctionReturnType<typeof api.forms.get>>;
type SubmissionRow = FunctionReturnType<typeof api.submissions.listForForm>[number];

type StatusLabel = SubmissionRow["status"];

const STATUS_LABELS: Record<StatusLabel, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  auto_published: "Auto published",
};

function formatTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return "";
  return new Date(timestamp).toISOString();
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "form"
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function displayValueForField(
  field: FormDoc["fields"][number] | undefined,
  raw: string,
): string {
  if (!field) return raw;
  if (
    field.type === "select" ||
    field.type === "yes_no" ||
    field.type === "checkbox"
  ) {
    const match = field.options?.find((option) => option.id === raw);
    return match?.label ?? raw;
  }
  if (field.type === "number") {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return raw;
    const formatted = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 20,
    }).format(parsed);
    const unit = field.currencyUnit?.trim();
    return unit ? `${formatted} ${unit}` : formatted;
  }
  return raw;
}

export function buildSubmissionsCsv(
  form: FormDoc,
  submissions: ReadonlyArray<SubmissionRow>,
): string {
  const fieldColumns = form.fields.map((field) => ({
    id: field.id,
    label: field.label || field.id,
    field,
  }));

  const header = [
    "Submitted at",
    "Submitter name",
    "Submitter ID",
    "Status",
    "Decided at",
    "Deny reason",
    ...fieldColumns.map((column) => column.label),
  ];

  const rows = submissions.map((submission) => {
    const submittedAt = formatTimestamp(
      submission.submittedAt ?? submission._creationTime,
    );
    const decidedAt = formatTimestamp(submission.decidedAt);
    const statusLabel = STATUS_LABELS[submission.status] ?? submission.status;
    const fieldValues = fieldColumns.map((column) => {
      const raw = submission.values[column.id] ?? "";
      return raw ? displayValueForField(column.field, raw) : "";
    });

    return [
      submittedAt,
      submission.submitterName,
      submission.submitterId,
      statusLabel,
      decidedAt,
      submission.denyReason ?? "",
      ...fieldValues,
    ];
  });

  const lines = [header, ...rows].map((row) =>
    row.map((cell) => escapeCsvCell(cell ?? "")).join(","),
  );

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function downloadSubmissionsCsv(
  form: FormDoc,
  submissions: ReadonlyArray<SubmissionRow>,
): void {
  const csv = buildSubmissionsCsv(form, submissions);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const filename = `${slugify(form.title)}-submissions.csv`;
  triggerDownload(blob, filename);
}

export async function downloadSubmissionsPdf(
  form: FormDoc,
  submissions: ReadonlyArray<SubmissionRow>,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const marginTop = 56;
  const marginBottom = 56;
  const contentWidth = pageWidth - marginX * 2;

  let cursorY = marginTop;

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > pageHeight - marginBottom) {
      doc.addPage();
      cursorY = marginTop;
    }
  };

  const writeLines = (
    text: string,
    options: {
      size: number;
      bold?: boolean;
      color?: [number, number, number];
      lineGap?: number;
    },
  ) => {
    const { size, bold = false, color = [20, 20, 20], lineGap = 2 } = options;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(size + lineGap);
      doc.text(line, marginX, cursorY);
      cursorY += size + lineGap;
    }
  };

  writeLines(form.title || "Untitled form", { size: 20, bold: true });
  writeLines(
    `Submissions: ${submissions.length} | Exported ${new Date().toLocaleString()}`,
    { size: 10, color: [110, 110, 110] },
  );
  if (form.description) {
    cursorY += 4;
    writeLines(form.description, { size: 10, color: [90, 90, 90] });
  }
  cursorY += 12;

  const fieldLabelById = new Map(
    form.fields.map((field) => [field.id, field.label || field.id] as const),
  );
  const fieldById = new Map(
    form.fields.map((field) => [field.id, field] as const),
  );

  submissions.forEach((submission, index) => {
    ensureSpace(60);

    if (index > 0) {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(marginX, cursorY, marginX + contentWidth, cursorY);
      cursorY += 14;
    }

    const submittedAt = new Date(
      submission.submittedAt ?? submission._creationTime,
    ).toLocaleString();
    const statusLabel = STATUS_LABELS[submission.status] ?? submission.status;

    writeLines(`${index + 1}. ${submission.submitterName}`, {
      size: 13,
      bold: true,
    });
    writeLines(
      `Submitted ${submittedAt} | Status: ${statusLabel} | User ID: ${submission.submitterId}`,
      { size: 9, color: [110, 110, 110] },
    );

    cursorY += 6;

    const orderedFieldIds = [
      ...form.fields.map((field) => field.id),
      ...Object.keys(submission.values).filter(
        (id) => !fieldLabelById.has(id),
      ),
    ];

    for (const fieldId of orderedFieldIds) {
      const value = submission.values[fieldId];
      if (value === undefined || value === null || value === "") continue;
      const label = fieldLabelById.get(fieldId) ?? fieldId;

      const display = displayValueForField(fieldById.get(fieldId), String(value));

      writeLines(label, { size: 10, bold: true });
      writeLines(display, { size: 10, color: [40, 40, 40] });
      cursorY += 4;
    }

    if (submission.denyReason) {
      writeLines("Deny reason", { size: 10, bold: true, color: [180, 40, 40] });
      writeLines(submission.denyReason, { size: 10, color: [120, 40, 40] });
    }

    cursorY += 10;
  });

  const filename = `${slugify(form.title)}-submissions.pdf`;
  doc.save(filename);
}
