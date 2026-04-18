import {
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Link, useParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle,
  CheckSquare,
  CircleNotch,
  ClockClockwise,
  Code as CodeIcon,
  Envelope,
  Eye,
  EyeSlash,
  FloppyDisk,
  Gear,
  Hash,
  ListBullets,
  PencilSimple,
  Plus,
  Question,
  Queue,
  SidebarSimple,
  SlidersHorizontal,
  Sparkle,
  SquaresFour,
  TextAlignLeft,
  TextT,
  ToggleRight,
  Trash,
  Warning,
  X,
} from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Tooltip } from "../components/ui/Tooltip";
import { WindowFrame } from "../components/window/WindowFrame";
import { WindowTabs } from "../components/window/WindowTabs";
import { useMe } from "../hooks/useMe";

type FieldType =
  | "short"
  | "paragraph"
  | "email"
  | "code"
  | "select"
  | "yes_no"
  | "checkbox"
  | "number";

type FieldOption = {
  id: string;
  label: string;
};

type FormField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  helperText?: string;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  currencyUnit?: string;
  options?: Array<FieldOption>;
};

// UI-facing metadata for each field type. Used by the field type picker,
// the field row label, and the preview rail so the three surfaces stay in
// sync. Keep the order of this array stable - it drives the picker order.
const FIELD_TYPE_META: Array<{
  value: FieldType;
  label: string;
  hint: string;
  hasOptions: boolean;
  hasLength: boolean;
  hasNumberBounds?: boolean;
}> = [
  {
    value: "short",
    label: "Short answer",
    hint: "One line of text",
    hasOptions: false,
    hasLength: true,
  },
  {
    value: "paragraph",
    label: "Long answer",
    hint: "Multiple lines of text",
    hasOptions: false,
    hasLength: true,
  },
  {
    value: "email",
    label: "Email",
    hint: "Validated email, private by default",
    hasOptions: false,
    hasLength: true,
  },
  {
    value: "code",
    label: "Code block",
    hint: "Posted with copy-ready formatting",
    hasOptions: false,
    hasLength: true,
  },
  {
    value: "select",
    label: "Dropdown",
    hint: "Pick one from a list",
    hasOptions: true,
    hasLength: false,
  },
  {
    value: "yes_no",
    label: "Yes or no",
    hint: "Binary choice",
    hasOptions: false,
    hasLength: false,
  },
  {
    value: "checkbox",
    label: "Confirmation",
    hint: "Single checkbox the submitter must tick",
    hasOptions: true,
    hasLength: false,
  },
  {
    value: "number",
    label: "Number",
    hint: "Numeric answer with optional min, max, and currency unit",
    hasOptions: false,
    hasLength: false,
    hasNumberBounds: true,
  },
];

const FIELD_TYPE_LABELS: Record<FieldType, string> = FIELD_TYPE_META.reduce(
  (acc, meta) => {
    acc[meta.value] = meta.label;
    return acc;
  },
  {} as Record<FieldType, string>,
);

function fieldTypeMeta(type: FieldType) {
  return (
    FIELD_TYPE_META.find((meta) => meta.value === type) ?? FIELD_TYPE_META[0]
  );
}

type EditableForm = {
  _id: Id<"forms">;
  _creationTime: number;
  guildId: Id<"guilds">;
  commandName: string;
  commandDescription: string;
  title: string;
  description?: string;
  fields: FormField[];
  requiresApproval: boolean;
  modQueueChannelId?: string;
  destinationChannelId?: string;
  destinationType?: "text" | "forum";
  forumTagId?: string;
  requiredRoleIds?: Array<string>;
  restrictedRoleIds?: Array<string>;
  modRoleIds?: Array<string>;
  successMessage?: string;
  maxSubmissionsPerUser?: number;
  maxSubmissionsPerDay?: number;
  showModeratorInFooter?: boolean;
  linkSubmitterOnPublish?: boolean;
  ticketMode?: boolean;
  autoCloseInactiveDays?: number;
  published: boolean;
  discordCommandId?: string;
};

type GuildChannel = {
  _id: Id<"guildChannels">;
  _creationTime: number;
  guildId: Id<"guilds">;
  discordChannelId: string;
  name: string;
  type: "text" | "forum" | "category";
  parentId?: string;
  parentName?: string;
  position: number;
  availableTags?: Array<{
    id: string;
    name: string;
  }>;
};

type GuildRole = {
  _id: Id<"guildRoles">;
  _creationTime: number;
  guildId: Id<"guilds">;
  discordRoleId: string;
  name: string;
  position: number;
  color?: number;
  managed: boolean;
};

type PaneId = "command" | "fields" | "preview";

const PANE_ORDER: Array<PaneId> = ["command", "fields", "preview"];
const VISIBLE_PANES_STORAGE_KEY = "forge.formEditor.visiblePanes";
const ACTIVE_PANE_STORAGE_KEY = "forge.formEditor.activePane";

export function EditForm() {
  const me = useMe();
  const params = useParams();
  const formId = params.formId as Id<"forms"> | undefined;
  const form = useQuery(api.forms.get, formId ? { formId } : "skip");

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/app/forms"
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-window)] transition-colors hover:border-[var(--color-ink)]"
            aria-label="Back to forms"
          >
            <ArrowLeft size={16} weight="bold" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Edit form</h1>
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
        label="forge / forms / editor"
        title="Form builder"
        description="Edit the slash command, shape the modal fields, then publish it to Discord."
        action={
          formId ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/app/forms/${formId}/logs`}
                title="View the activity log for this form"
                className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
              >
                <ClockClockwise size={16} weight="bold" aria-hidden />
                <span>Logs</span>
              </Link>
              <Link
                to={`/app/forms/${formId}/results`}
                title="View every submission connected to this form"
                className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-2 text-sm font-medium text-[var(--color-surface)] shadow-[var(--shadow-window)]"
              >
                <Queue size={16} weight="bold" aria-hidden />
                <span>Results</span>
              </Link>
            </div>
          ) : null
        }
      >
        {!formId ? (
          <InlineState
            icon={<Warning size={18} weight="fill" />}
            title="Missing form id"
            description="Open this page from the Forms list so Forge knows which form to load."
            tone="error"
          />
        ) : form === undefined ? (
          <LoadingState label="Loading form" />
        ) : form === null ? (
          <InlineState
            icon={<Warning size={18} weight="fill" />}
            title="Form not found"
            description="This draft may have been deleted or the link is stale."
            tone="error"
          />
        ) : (
          <FormEditor key={form._id} form={form} />
        )}
      </WindowFrame>
    </main>
  );
}

function FormEditor({ form }: { form: EditableForm }) {
  const updateForm = useMutation(api.forms.update);
  const publishForm = useAction(api.discord.registerCommand);
  const refreshGuildChannels = useAction(api.discord.refreshGuildChannels);
  const refreshGuildRoles = useAction(api.discord.refreshGuildRoles);
  const guildChannels =
    useQuery(api.guilds.listChannels, { guildId: form.guildId }) ?? [];
  const guildRoles = useQuery(api.guilds.listRoles, { guildId: form.guildId }) ?? [];

  const [title, setTitle] = useState(form.title);
  const [commandName, setCommandName] = useState(form.commandName);
  const [commandDescription, setCommandDescription] = useState(
    form.commandDescription,
  );
  const [description, setDescription] = useState(form.description ?? "");
  const [requiresApproval, setRequiresApproval] = useState(form.requiresApproval);
  const [modQueueChannelId, setModQueueChannelId] = useState(
    form.modQueueChannelId ?? "",
  );
  const [destinationType, setDestinationType] = useState<
    "text" | "forum" | ""
  >(form.destinationType ?? "");
  const [destinationChannelId, setDestinationChannelId] = useState(
    form.destinationChannelId ?? "",
  );
  const [forumTagId, setForumTagId] = useState(form.forumTagId ?? "");
  const [requiredRoleIds, setRequiredRoleIds] = useState<Array<string>>(
    form.requiredRoleIds ?? [],
  );
  const [restrictedRoleIds, setRestrictedRoleIds] = useState<Array<string>>(
    form.restrictedRoleIds ?? [],
  );
  const [modRoleIds, setModRoleIds] = useState<Array<string>>(
    form.modRoleIds ?? [],
  );
  const [successMessage, setSuccessMessage] = useState(form.successMessage ?? "");
  const [maxSubmissionsPerUser, setMaxSubmissionsPerUser] = useState<
    number | undefined
  >(form.maxSubmissionsPerUser);
  const [maxSubmissionsPerDay, setMaxSubmissionsPerDay] = useState<
    number | undefined
  >(form.maxSubmissionsPerDay);
  // Undefined on a saved form means "keep the default" (show the name) so
  // we coerce to true for the toggle state.
  const [showModeratorInFooter, setShowModeratorInFooter] = useState<boolean>(
    form.showModeratorInFooter ?? true,
  );
  // Undefined means "show" (default) so we coerce to true for the toggle.
  const [linkSubmitterOnPublish, setLinkSubmitterOnPublish] = useState<boolean>(
    form.linkSubmitterOnPublish ?? true,
  );
  // Ticket mode flips the published message from one-shot to a tracked ticket
  // with Claim/Resolve/Close buttons. Default off so every existing form keeps
  // its current behavior until an admin opts in.
  const [ticketMode, setTicketMode] = useState<boolean>(
    form.ticketMode ?? false,
  );
  const [autoCloseInactiveDays, setAutoCloseInactiveDays] = useState<
    number | undefined
  >(form.autoCloseInactiveDays);
  const [fields, setFields] = useState<Array<FormField>>(form.fields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(
    form.fields[0]?.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRefreshingChannels, setIsRefreshingChannels] = useState(false);
  const [isRefreshingRoles, setIsRefreshingRoles] = useState(false);
  const [isPublished, setIsPublished] = useState(form.published);
  const [hasEverPublished, setHasEverPublished] = useState(
    Boolean(form.published || form.discordCommandId),
  );
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() =>
    createDraftSnapshot(form),
  );
  const [visiblePanes, setVisiblePanes] = useState<Array<PaneId>>(
    readVisiblePanes,
  );
  const [activeMobilePane, setActiveMobilePane] = useState<PaneId>(
    readActiveMobilePane,
  );

  const activePane = visiblePanes.includes(activeMobilePane)
    ? activeMobilePane
    : visiblePanes[0];
  const textChannels = guildChannels.filter((channel) => channel.type === "text");
  const forumChannels = guildChannels.filter(
    (channel) => channel.type === "forum",
  );
  const destinationChannels =
    destinationType === "forum" ? forumChannels : textChannels;
  const selectedDestinationChannel =
    destinationChannels.find(
      (channel) => channel.discordChannelId === destinationChannelId,
    ) ?? null;
  const currentSnapshot = createDraftSnapshot({
    title,
    commandName,
    commandDescription,
    description,
    requiresApproval,
    modQueueChannelId,
    destinationChannelId,
    destinationType: destinationType || undefined,
    forumTagId,
    requiredRoleIds,
    restrictedRoleIds,
    modRoleIds,
    successMessage,
    maxSubmissionsPerUser,
    maxSubmissionsPerDay,
    showModeratorInFooter,
    linkSubmitterOnPublish,
    ticketMode,
    autoCloseInactiveDays,
    fields,
  });
  const hasUnsavedChanges = currentSnapshot !== lastSavedSnapshot;
  const publishChecks = [
    {
      label: "Title and command copy are filled in",
      complete:
        title.trim().length > 0 &&
        commandName.trim().length > 0 &&
        commandDescription.trim().length > 0,
    },
    {
      label: "At least one modal field exists",
      complete: fields.length > 0,
    },
    {
      label: "The command is linked to Discord",
      complete: isPublished,
    },
  ] as const;
  const completedChecks = publishChecks.filter((item) => item.complete).length;

  const canPublish =
    title.trim().length > 0 &&
    commandName.trim().length > 0 &&
    commandDescription.trim().length > 0 &&
    fields.length > 0 &&
    !isSaving &&
    !isPublishing;

  const saveDraft = async () => {
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const updated = await updateForm({
        formId: form._id,
        title,
        commandName,
        commandDescription,
        description: description.trim() ? description : undefined,
        requiresApproval,
        fields,
        modQueueChannelId: modQueueChannelId || undefined,
        destinationChannelId: destinationChannelId || undefined,
        destinationType: destinationType || undefined,
        forumTagId: forumTagId || undefined,
        requiredRoleIds: requiredRoleIds.length > 0 ? requiredRoleIds : undefined,
        restrictedRoleIds:
          restrictedRoleIds.length > 0 ? restrictedRoleIds : undefined,
        modRoleIds: modRoleIds.length > 0 ? modRoleIds : undefined,
        successMessage: successMessage.trim() ? successMessage : undefined,
        maxSubmissionsPerUser,
        maxSubmissionsPerDay,
        showModeratorInFooter,
        linkSubmitterOnPublish,
        ticketMode,
        autoCloseInactiveDays,
      });
      setTitle(updated.title);
      setCommandName(updated.commandName);
      setCommandDescription(updated.commandDescription);
      setDescription(updated.description ?? "");
      setModQueueChannelId(updated.modQueueChannelId ?? "");
      setDestinationType(updated.destinationType ?? "");
      setDestinationChannelId(updated.destinationChannelId ?? "");
      setForumTagId(updated.forumTagId ?? "");
      setRequiredRoleIds(updated.requiredRoleIds ?? []);
      setRestrictedRoleIds(updated.restrictedRoleIds ?? []);
      setModRoleIds(updated.modRoleIds ?? []);
      setSuccessMessage(updated.successMessage ?? "");
      setMaxSubmissionsPerUser(updated.maxSubmissionsPerUser);
      setMaxSubmissionsPerDay(updated.maxSubmissionsPerDay);
      setShowModeratorInFooter(updated.showModeratorInFooter ?? true);
      setLinkSubmitterOnPublish(updated.linkSubmitterOnPublish ?? true);
      setTicketMode(updated.ticketMode ?? false);
      setAutoCloseInactiveDays(updated.autoCloseInactiveDays);
      setFields(updated.fields);
      setSelectedFieldId((current) =>
        updated.fields.some((field) => field.id === current)
          ? current
          : updated.fields[0]?.id ?? null,
      );
      setIsPublished(updated.published);
      setLastSavedSnapshot(createDraftSnapshot(updated));
      setSuccess("Draft saved.");
      return updated;
    } catch (err) {
      const message = formatFormError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setError(null);
    setSuccess(null);
    setIsPublishing(true);
    try {
      await saveDraft();
      const result = await publishForm({ formId: form._id });
      setIsPublished(true);
      setHasEverPublished(true);
      setSuccess(`Published to Discord. Command id ${result.commandId}.`);
    } catch (err) {
      setSuccess(null);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not publish the form.");
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const addField = (type: FieldType) => {
    const id = createFieldId();
    const nextField: FormField = {
      id,
      label: defaultFieldLabel(type),
      type,
      required: true,
      placeholder: undefined,
      helperText: defaultHelperText(type),
      minLength: undefined,
      maxLength: defaultMaxLength(type),
      options: defaultOptions(type),
    };
    setFields((current) => [...current, nextField]);
    setSelectedFieldId(id);
    setSuccess(null);
    setError(null);
    setActivePaneState("fields");
  };

  const updateField = (
    fieldId: string,
    updater: (field: FormField) => FormField,
  ) => {
    setSuccess(null);
    setFields((current) =>
      current.map((field) => (field.id === fieldId ? updater(field) : field)),
    );
  };

  const removeField = (fieldId: string) => {
    setFields((current) => {
      const next = current.filter((field) => field.id !== fieldId);
      setSelectedFieldId(next[0]?.id ?? null);
      return next;
    });
    setSuccess(null);
  };

  const moveField = (fieldId: string, direction: -1 | 1) => {
    setFields((current) => {
      const index = current.findIndex((field) => field.id === fieldId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      const [field] = next.splice(index, 1);
      next.splice(target, 0, field);
      return next;
    });
    setSuccess(null);
  };

  const togglePane = (paneId: PaneId) => {
    const nextVisible = visiblePanes.includes(paneId)
      ? visiblePanes.filter((pane) => pane !== paneId)
      : [...visiblePanes, paneId];
    if (nextVisible.length === 0) {
      return;
    }

    const ordered = sortVisiblePanes(nextVisible);
    setVisiblePanesState(
      ordered,
      ordered.includes(activePane) ? activePane : ordered[0],
    );
  };

  const showOnlyPane = (paneId: PaneId) => {
    setVisiblePanesState([paneId], paneId);
  };

  const showAllPanes = () => {
    setVisiblePanesState(PANE_ORDER, activePane);
  };

  const setActivePaneState = (paneId: PaneId) => {
    setActiveMobilePane(paneId);
    writeActivePane(paneId);
  };

  const setVisiblePanesState = (
    nextVisible: Array<PaneId>,
    nextActive: PaneId,
  ) => {
    setVisiblePanes(nextVisible);
    writeVisiblePanes(nextVisible);
    setActivePaneState(nextActive);
  };

  const focusField = (fieldId: string) => {
    setSelectedFieldId(fieldId);
    setActivePaneState("fields");
  };

  const handleRefreshChannels = async () => {
    setError(null);
    setSuccess(null);
    setIsRefreshingChannels(true);
    try {
      const result = await refreshGuildChannels({ guildId: form.guildId });
      setSuccess(`Refreshed ${result.count} channels from Discord.`);
    } catch (err) {
      setError(formatFormError(err));
    } finally {
      setIsRefreshingChannels(false);
    }
  };

  const handleRefreshRoles = async () => {
    setError(null);
    setSuccess(null);
    setIsRefreshingRoles(true);
    try {
      const result = await refreshGuildRoles({ guildId: form.guildId });
      setSuccess(`Refreshed ${result.count} roles from Discord.`);
    } catch (err) {
      setError(formatFormError(err));
    } finally {
      setIsRefreshingRoles(false);
    }
  };

  const toggleRoleSelection = (
    roleId: string,
    setter: Dispatch<SetStateAction<Array<string>>>,
  ) => {
    setter((current) =>
      current.includes(roleId)
        ? current.filter((existingRoleId) => existingRoleId !== roleId)
        : [...current, roleId],
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <InlineState
          icon={<Warning size={18} weight="fill" />}
          title="Form update failed"
          description={error}
          tone="error"
        />
      ) : null}

      {success ? (
        <InlineState
          icon={<CheckCircle size={18} weight="fill" />}
          title={isPublished ? "Form published" : "Draft saved"}
          description={success}
          tone="ok"
        />
      ) : null}

      {hasUnsavedChanges ? (
        <InlineState
          icon={<Warning size={18} weight="fill" />}
          title="Unsaved changes"
          description="Save draft stores this editor state in Forge only. Update Discord command saves first, then syncs the command on Discord."
          tone="neutral"
        />
      ) : null}

      {!hasUnsavedChanges && hasEverPublished && !isPublished ? (
        <InlineState
          icon={<Warning size={18} weight="fill" />}
          title="Discord is out of sync"
          description="Your latest draft is saved, but members still see the older command settings in Discord until you update the command."
          tone="neutral"
        />
      ) : null}

      <section className="sticky top-4 z-10 rounded-[calc(var(--radius-window)+4px)] border border-[color-mix(in_oklab,var(--color-ink)_10%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-surface)_92%,var(--color-bg))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.08)] backdrop-blur-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[color-mix(in_oklab,var(--color-ink)_10%,var(--color-border))] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-muted)]">
                  Editor workspace
                </span>
                <span
                  className={
                    isPublished
                      ? "rounded-full border border-[color-mix(in_oklab,var(--color-success)_35%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-success)_12%,var(--color-surface))] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-success)]"
                      : "rounded-full border border-[color-mix(in_oklab,var(--color-warning)_35%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-warning)_10%,var(--color-surface))] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-ink)]"
                  }
                >
                  {isPublished ? "Published" : "Draft"}
                </span>
                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-muted)]">
                  {fields.length}/5 fields
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight text-[var(--color-ink)]">
                  {title || "Untitled form"}
                </p>
                <p className="text-sm text-[var(--color-muted)]">
                  Shape the workspace. Hide panes when you need room, then bring
                  them back to save or publish.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Tooltip content="Save to Forge only. Useful when you want to keep working without changing the live Discord command yet.">
                <button
                  type="button"
                  onClick={() => void saveDraft()}
                  disabled={isSaving || isPublishing}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:opacity-60"
                >
                  {isSaving ? (
                    <CircleNotch size={16} weight="bold" className="animate-spin" />
                  ) : (
                    <FloppyDisk size={16} weight="bold" aria-hidden />
                  )}
                  <span>{isSaving ? "Saving" : "Save draft"}</span>
                </button>
              </Tooltip>

              <Tooltip content="This saves your draft first, then creates or updates the slash command on Discord so members see the latest version.">
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={!canPublish}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-[var(--color-surface)] shadow-[var(--shadow-window)] transition-transform duration-150 active:translate-y-px disabled:opacity-60"
                >
                  {isPublishing ? (
                    <CircleNotch size={16} weight="bold" className="animate-spin" />
                  ) : (
                    <Sparkle size={16} weight="bold" aria-hidden />
                  )}
                  <span>
                    {hasEverPublished ? "Update Discord command" : "Publish to Discord"}
                  </span>
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="grid gap-3 border-t border-[var(--color-border)] pt-4 xl:grid-cols-[1fr_auto] xl:items-center">
            <div className="flex flex-wrap gap-2">
              {PANE_ORDER.map((paneId) => (
                <PaneToggleButton
                  key={paneId}
                  paneId={paneId}
                  visible={visiblePanes.includes(paneId)}
                  onToggle={() => togglePane(paneId)}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Tooltip content="Restore the full builder workspace with all three panes visible.">
                <button
                  type="button"
                  onClick={showAllPanes}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
                >
                  <SquaresFour size={16} weight="bold" aria-hidden />
                  <span>All panes</span>
                </button>
              </Tooltip>

              <Tooltip content="Focus just the modal fields pane when you need maximum room to edit questions.">
                <button
                  type="button"
                  onClick={() => showOnlyPane("fields")}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
                >
                  <SidebarSimple size={16} weight="bold" aria-hidden />
                  <span>Focus fields</span>
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_82%,white)] px-4 py-3 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">
                  Mobile pane
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  Switch between the visible panes below.
                </p>
              </div>
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-muted)]">
                {visiblePanes.length} visible
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {visiblePanes.map((paneId) => (
                <button
                  key={paneId}
                  type="button"
                  onClick={() => setActivePaneState(paneId)}
                  className={
                    activePane === paneId
                      ? "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-2 text-sm font-medium text-[var(--color-surface)]"
                      : "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)]"
                  }
                >
                  <PaneIcon paneId={paneId} />
                  <span>{paneLabel(paneId)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4">
        {visiblePanes.includes("command") ? (
          <section className={paneShellClass("command", activePane)}>
            <PaneHeading
              paneId="command"
              title="Command settings"
              description="Command identity, status, and publish readiness."
              badge={`${completedChecks}/${publishChecks.length} ready`}
              tooltip="This pane controls the slash command copy and the basic workflow after submit."
            />

            <div className="grid gap-4">
              <label className="flex min-w-0 flex-col gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                  <span>Form title</span>
                  <Tooltip content="Shown at the top of the Discord modal.">
                    <span
                      tabIndex={0}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
                    >
                      <Question size={11} weight="bold" aria-hidden />
                    </span>
                  </Tooltip>
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="min-h-12 w-full max-w-full rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
                  maxLength={80}
                />
              </label>

              <label className="flex min-w-0 flex-col gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                  <span>Slash command name</span>
                  <Tooltip content="Discord allows 1 to 32 lowercase characters, numbers, and hyphens.">
                    <span
                      tabIndex={0}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
                    >
                      <Question size={11} weight="bold" aria-hidden />
                    </span>
                  </Tooltip>
                </span>
                <div className="flex min-h-12 w-full min-w-0 items-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                  <span className="mr-2 text-sm text-[var(--color-muted)]">/</span>
                  <input
                    value={commandName}
                    onChange={(event) => setCommandName(event.target.value)}
                    className="w-full min-w-0 bg-transparent text-sm outline-none"
                    maxLength={32}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
              </label>

              <label className="flex min-w-0 flex-col gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                  <span>Command description</span>
                  <Tooltip content="Shown in the Discord command picker below the slash command name.">
                    <span
                      tabIndex={0}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
                    >
                      <Question size={11} weight="bold" aria-hidden />
                    </span>
                  </Tooltip>
                </span>
                <input
                  value={commandDescription}
                  onChange={(event) => setCommandDescription(event.target.value)}
                  className="min-h-12 w-full max-w-full rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
                  maxLength={100}
                />
              </label>

              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-sm font-medium text-[var(--color-ink)]">
                  Internal notes
                </span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-32 w-full max-w-full rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
                  maxLength={500}
                  placeholder="Capture the intent behind this workflow for future edits."
                />
              </label>

              <label className="flex items-start gap-3 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(event) => setRequiresApproval(event.target.checked)}
                  className="mt-1"
                />
                <span className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                    <span>Requires approval</span>
                    <Tooltip content="Keep this on when mods should review every submission before it moves onward.">
                      <span
                        tabIndex={0}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
                      >
                        <Question size={11} weight="bold" aria-hidden />
                      </span>
                    </Tooltip>
                  </span>
                  <span className="text-sm text-[var(--color-muted)]">
                    Keep this on for mod reviewed submissions. Turn it off once
                    destination publishing is in place and you want a straight
                    through intake flow.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
                <input
                  type="checkbox"
                  checked={showModeratorInFooter}
                  onChange={(event) =>
                    setShowModeratorInFooter(event.target.checked)
                  }
                  className="mt-1"
                />
                <span className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                    <span>Show moderator name on Discord</span>
                    <Tooltip content="When on, the published Discord footer reads 'Approved by {name}'. Turn it off to just show 'Approved' and keep the moderator anonymous to the channel.">
                      <span
                        tabIndex={0}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
                      >
                        <Question size={11} weight="bold" aria-hidden />
                      </span>
                    </Tooltip>
                  </span>
                  <span className="text-sm text-[var(--color-muted)]">
                    Shows the moderator's name in the footer of published
                    embeds. Turn off for anonymous moderation. The results
                    dashboard always records who decided each submission.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
                <input
                  type="checkbox"
                  checked={linkSubmitterOnPublish}
                  onChange={(event) =>
                    setLinkSubmitterOnPublish(event.target.checked)
                  }
                  className="mt-1"
                />
                <span className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                    <span>Link submitter on publish</span>
                    <Tooltip content="Prepends 'Submitted by @handle' to the published message so channel members can click through to the submitter. Mentions never ping; the handle just renders as a clickable pill.">
                      <span
                        tabIndex={0}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
                      >
                        <Question size={11} weight="bold" aria-hidden />
                      </span>
                    </Tooltip>
                  </span>
                  <span className="text-sm text-[var(--color-muted)]">
                    Clickable handle link to the submitter, without pinging
                    them. Works whether approval is on or off. Turn off for
                    anonymous submission flows.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
                <input
                  type="checkbox"
                  checked={ticketMode}
                  onChange={(event) => setTicketMode(event.target.checked)}
                  className="mt-1"
                />
                <span className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                    <span>Ticket mode</span>
                    <Tooltip content="Treat each submission as a support ticket. The published message gets Claim, Resolve, Reopen, and Close buttons so mods can track lifecycle right from Discord. Turn on for support or bounty flows; leave off for one-shot forms.">
                      <span
                        tabIndex={0}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
                      >
                        <Question size={11} weight="bold" aria-hidden />
                      </span>
                    </Tooltip>
                  </span>
                  <span className="text-sm text-[var(--color-muted)]">
                    Adds Claim, Resolve, Reopen, and Close buttons to the
                    published message and tracks status and assignee on the
                    submission. Optional auto close runs on stale tickets.
                  </span>
                </span>
              </label>

              {ticketMode ? (
                <label className="flex items-start gap-3 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
                  <span className="flex flex-col gap-1">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                      <span>Auto close after</span>
                      <Tooltip content="Tickets with no activity for this many days flip to 'closed' automatically. Leave blank or 0 to keep tickets open forever. Cron runs hourly.">
                        <span
                          tabIndex={0}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
                        >
                          <Question size={11} weight="bold" aria-hidden />
                        </span>
                      </Tooltip>
                    </span>
                    <span className="text-sm text-[var(--color-muted)]">
                      Days of inactivity before a ticket auto closes. Leave
                      blank to disable. Maximum 365.
                    </span>
                    <span className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={autoCloseInactiveDays ?? ""}
                        onChange={(event) =>
                          setAutoCloseInactiveDays(
                            numberOrUndefined(event.target.value),
                          )
                        }
                        className="min-h-10 w-28 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
                        placeholder="Off"
                      />
                      <span className="text-sm text-[var(--color-muted)]">
                        days
                      </span>
                    </span>
                  </span>
                </label>
              ) : null}

              <div className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      Routing
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      Choose where approved submissions land and where review
                      messages go when approval stays on.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRefreshChannels()}
                    disabled={isRefreshingChannels || isSaving || isPublishing}
                    className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_68%,white)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:opacity-60"
                  >
                    {isRefreshingChannels ? (
                      <CircleNotch
                        size={14}
                        weight="bold"
                        className="animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <ArrowUp size={14} weight="bold" aria-hidden />
                    )}
                    <span>{isRefreshingChannels ? "Refreshing" : "Refresh channels"}</span>
                  </button>
                </div>

                {guildChannels.length === 0 ? (
                  <div className="mt-4 rounded-[calc(var(--radius-window)-2px)] border border-dashed border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-4 py-4 text-sm text-[var(--color-muted)]">
                    No channels cached yet. Refresh channels to load text and
                    forum destinations for this server.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-[var(--color-ink)]">
                        Approval queue channel
                      </span>
                      <select
                        value={modQueueChannelId}
                        onChange={(event) => setModQueueChannelId(event.target.value)}
                        className="min-h-12 w-full max-w-full rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
                      >
                        <option value="">Unset</option>
                        {textChannels.map((channel) => (
                          <option
                            key={channel.discordChannelId}
                            value={channel.discordChannelId}
                          >
                            {formatChannelLabel(channel)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-[var(--color-ink)]">
                          Destination type
                        </span>
                        <select
                          value={destinationType}
                          onChange={(event) => {
                            const nextType = event.target.value as
                              | "text"
                              | "forum"
                              | "";
                            setDestinationType(nextType);
                            setDestinationChannelId("");
                            setForumTagId("");
                          }}
                          className="min-h-12 w-full max-w-full rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
                        >
                          <option value="">Unset</option>
                          <option value="text">Text</option>
                          <option value="forum">Forum</option>
                        </select>
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-[var(--color-ink)]">
                          Destination channel
                        </span>
                        <select
                          value={destinationChannelId}
                          onChange={(event) => {
                            setDestinationChannelId(event.target.value);
                            setForumTagId("");
                          }}
                          disabled={!destinationType}
                          className="min-h-12 w-full max-w-full rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-ink)] disabled:opacity-60"
                        >
                          <option value="">
                            {destinationType
                              ? "Select a destination"
                              : "Pick a destination type first"}
                          </option>
                          {destinationChannels.map((channel) => (
                            <option
                              key={channel.discordChannelId}
                              value={channel.discordChannelId}
                            >
                              {formatChannelLabel(channel)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {destinationType === "forum" ? (
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-[var(--color-ink)]">
                          Forum tag
                        </span>
                        <select
                          value={forumTagId}
                          onChange={(event) => setForumTagId(event.target.value)}
                          className="min-h-12 w-full max-w-full rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
                        >
                          <option value="">No tag</option>
                          {(selectedDestinationChannel?.availableTags ?? []).map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      Access and submission rules
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      Decide who can open this form, how often they can submit it,
                      and what they see after a successful submit.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRefreshRoles()}
                    disabled={isRefreshingRoles || isSaving || isPublishing}
                    className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_68%,white)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:opacity-60"
                  >
                    {isRefreshingRoles ? (
                      <CircleNotch
                        size={14}
                        weight="bold"
                        className="animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <ArrowUp size={14} weight="bold" aria-hidden />
                    )}
                    <span>{isRefreshingRoles ? "Refreshing" : "Refresh roles"}</span>
                  </button>
                </div>

                {guildRoles.length === 0 ? (
                  <div className="mt-4 rounded-[calc(var(--radius-window)-2px)] border border-dashed border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-4 py-4 text-sm text-[var(--color-muted)]">
                    No roles cached yet. Refresh roles to choose who can use this
                    form.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4">
                    <RolePicker
                      title="Required roles"
                      description="Members must have every selected role before the command can open."
                      roles={guildRoles}
                      selectedRoleIds={requiredRoleIds}
                      onToggle={(roleId) =>
                        toggleRoleSelection(roleId, setRequiredRoleIds)
                      }
                    />

                    <RolePicker
                      title="Blocked roles"
                      description="Members with any selected role will be blocked from using the form."
                      roles={guildRoles}
                      selectedRoleIds={restrictedRoleIds}
                      onToggle={(roleId) =>
                        toggleRoleSelection(roleId, setRestrictedRoleIds)
                      }
                    />

                    {requiresApproval ? (
                      <RolePicker
                        title="Moderator roles"
                        description="Only members with any selected role can approve or reject submissions. Leave empty to allow any signed-in admin."
                        roles={guildRoles}
                        selectedRoleIds={modRoleIds}
                        onToggle={(roleId) =>
                          toggleRoleSelection(roleId, setModRoleIds)
                        }
                      />
                    ) : null}
                  </div>
                )}

                <div className="mt-4 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex min-w-0 items-start gap-3 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-4 py-3">
                      <input
                        type="checkbox"
                        checked={maxSubmissionsPerUser !== undefined}
                        onChange={(event) =>
                          setMaxSubmissionsPerUser(
                            event.target.checked
                              ? Math.max(maxSubmissionsPerUser ?? 1, 1)
                              : undefined,
                          )
                        }
                        className="mt-1"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-2">
                        <span className="text-sm font-medium text-[var(--color-ink)]">
                          Lifetime limit per user
                        </span>
                        <span className="text-sm text-[var(--color-muted)]">
                          Stop a member from submitting this form more than a set
                          number of times.
                        </span>
                        <input
                          type="number"
                          value={maxSubmissionsPerUser ?? ""}
                          onChange={(event) =>
                            setMaxSubmissionsPerUser(
                              numberOrUndefined(event.target.value),
                            )
                          }
                          disabled={maxSubmissionsPerUser === undefined}
                          min={1}
                          max={10000}
                          className="min-h-11 w-full max-w-full rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-ink)] disabled:opacity-60"
                        />
                      </span>
                    </label>

                    <label className="flex min-w-0 items-start gap-3 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-4 py-3">
                      <input
                        type="checkbox"
                        checked={maxSubmissionsPerDay !== undefined}
                        onChange={(event) =>
                          setMaxSubmissionsPerDay(
                            event.target.checked
                              ? Math.max(maxSubmissionsPerDay ?? 1, 1)
                              : undefined,
                          )
                        }
                        className="mt-1"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-2">
                        <span className="text-sm font-medium text-[var(--color-ink)]">
                          Daily limit per user
                        </span>
                        <span className="text-sm text-[var(--color-muted)]">
                          Limit how many times one member can submit this form in
                          a UTC day.
                        </span>
                        <input
                          type="number"
                          value={maxSubmissionsPerDay ?? ""}
                          onChange={(event) =>
                            setMaxSubmissionsPerDay(
                              numberOrUndefined(event.target.value),
                            )
                          }
                          disabled={maxSubmissionsPerDay === undefined}
                          min={1}
                          max={10000}
                          className="min-h-11 w-full max-w-full rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-ink)] disabled:opacity-60"
                        />
                      </span>
                    </label>
                  </div>

                  <label className="flex min-w-0 flex-col gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                      <span>Submission success message</span>
                      <Tooltip content="This message is shown back to the member in Discord after a successful submit.">
                        <span
                          tabIndex={0}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
                        >
                          <Question size={11} weight="bold" aria-hidden />
                        </span>
                      </Tooltip>
                    </span>
                    <textarea
                      value={successMessage}
                      onChange={(event) => setSuccessMessage(event.target.value)}
                      className="min-h-28 w-full max-w-full rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
                      maxLength={500}
                      placeholder="Submission received."
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      Publish readiness
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      Know what still blocks the Discord publish step.
                    </p>
                  </div>
                  <Tooltip content="Publish needs a valid command name, command copy, and at least one field.">
                    <span
                      tabIndex={0}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
                    >
                      <Question size={12} weight="bold" aria-hidden />
                    </span>
                  </Tooltip>
                </div>
                <ul className="mt-4 flex flex-col gap-2">
                  {publishChecks.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center gap-3 rounded-[calc(var(--radius-window)-2px)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-3 py-2"
                    >
                      <span
                        className={
                          item.complete
                            ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-success)_18%,white)] text-[var(--color-success)]"
                            : "inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-warning)_15%,white)] text-[var(--color-ink)]"
                        }
                      >
                        {item.complete ? (
                          <Check size={12} weight="bold" aria-hidden />
                        ) : (
                          <Warning size={12} weight="fill" aria-hidden />
                        )}
                      </span>
                      <span className="text-sm text-[var(--color-ink)]">
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-end">
                {hasUnsavedChanges ? (
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-muted)]">
                    <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-warning)]" aria-hidden />
                    Unsaved changes
                  </span>
                ) : null}
                <div className="flex flex-wrap gap-2 sm:ml-auto">
                  <Tooltip content="Save to Forge only. Useful when you want to keep working without changing the live Discord command yet.">
                    <button
                      type="button"
                      onClick={() => void saveDraft()}
                      disabled={isSaving || isPublishing}
                      className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:opacity-60"
                    >
                      {isSaving ? (
                        <CircleNotch size={16} weight="bold" className="animate-spin" />
                      ) : (
                        <FloppyDisk size={16} weight="bold" aria-hidden />
                      )}
                      <span>{isSaving ? "Saving" : "Save draft"}</span>
                    </button>
                  </Tooltip>

                  <Tooltip content="This saves your draft first, then creates or updates the slash command on Discord so members see the latest version.">
                    <button
                      type="button"
                      onClick={() => void handlePublish()}
                      disabled={!canPublish}
                      className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-[var(--color-surface)] shadow-[var(--shadow-window)] transition-transform duration-150 active:translate-y-px disabled:opacity-60"
                    >
                      {isPublishing ? (
                        <CircleNotch size={16} weight="bold" className="animate-spin" />
                      ) : (
                        <Sparkle size={16} weight="bold" aria-hidden />
                      )}
                      <span>
                        {hasEverPublished ? "Update Discord command" : "Publish to Discord"}
                      </span>
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {visiblePanes.includes("fields") || visiblePanes.includes("preview") ? (
        <div
          className={bottomRowGridClass(
            (visiblePanes.includes("fields") ? 1 : 0) +
              (visiblePanes.includes("preview") ? 1 : 0),
          )}
        >
        {visiblePanes.includes("fields") ? (
          <section className={paneShellClass("fields", activePane)}>
            <PaneHeading
              paneId="fields"
              title="Modal fields"
              description="Build the questions people actually submit."
              badge={`${fields.length}/5`}
              tooltip="Discord modal forms can include up to five text inputs."
              action={
                <FieldTypePicker
                  onAdd={addField}
                  disabled={fields.length >= 5}
                />
              }
            />

            {fields.length === 0 ? (
              <InlineState
                icon={<Queue size={18} weight="fill" />}
                title="No fields yet"
                description="Add at least one field before you publish this slash command."
                tone="neutral"
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {fields.map((field, index) => {
                  const selected = field.id === selectedFieldId;
                  return (
                    <li
                      key={field.id}
                      className={
                        selected
                          ? "min-w-0 rounded-[calc(var(--radius-window)+2px)] border border-[var(--color-ink)] bg-[var(--color-surface)] p-4 shadow-[0_14px_28px_rgba(0,0,0,0.07)]"
                          : "min-w-0 rounded-[calc(var(--radius-window)+2px)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-ink)]"
                      }
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFieldId(selected ? null : field.id)
                          }
                          className="group flex min-w-0 flex-1 items-start gap-3 text-left"
                          aria-expanded={selected}
                          aria-label={`Edit ${field.label || "untitled field"}`}
                        >
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[var(--color-border)] px-1 text-xs text-[var(--color-muted)]">
                            {index + 1}
                          </span>
                          <span
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] text-[var(--color-muted)] transition-colors group-hover:border-[var(--color-ink)] group-hover:text-[var(--color-ink)]"
                            aria-hidden
                          >
                            <PencilSimple size={12} weight="bold" />
                          </span>
                          <span className="flex min-w-0 flex-col gap-1">
                            <span className="truncate text-sm font-medium text-[var(--color-ink)]">
                              {field.label || "Untitled field"}
                            </span>
                            <span className="text-xs text-[var(--color-muted)]">
                              {FIELD_TYPE_LABELS[field.type]} •{" "}
                              {field.required ? "Required" : "Optional"}
                            </span>
                          </span>
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                          <Tooltip content="Move this field earlier in the modal.">
                            <button
                              type="button"
                              onClick={() => moveField(field.id, -1)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_68%,white)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
                              aria-label="Move field up"
                            >
                              <ArrowUp size={14} weight="bold" />
                            </button>
                          </Tooltip>
                          <Tooltip content="Move this field later in the modal.">
                            <button
                              type="button"
                              onClick={() => moveField(field.id, 1)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_68%,white)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
                              aria-label="Move field down"
                            >
                              <ArrowDown size={14} weight="bold" />
                            </button>
                          </Tooltip>
                          <Tooltip content="Delete this field from the modal.">
                            <button
                              type="button"
                              onClick={() => removeField(field.id)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[color-mix(in_oklab,var(--color-danger)_35%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-danger)_7%,white)] text-[var(--color-danger)] transition-colors hover:border-[var(--color-danger)]"
                              aria-label="Remove field"
                            >
                              <Trash size={14} weight="bold" />
                            </button>
                          </Tooltip>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-2.5 py-1 text-xs text-[var(--color-muted)]">
                          {field.id}
                        </span>
                        <Tooltip content="Stable id is internal only. Members never see it, though Forge uses it when storing answers.">
                          <span
                            tabIndex={0}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
                          >
                            <Question size={11} weight="bold" aria-hidden />
                          </span>
                        </Tooltip>
                      </div>

                      {selected ? (
                        <FieldEditor
                          field={field}
                          onChange={(updater) => updateField(field.id, updater)}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {fields.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
                <span className="mr-auto text-xs text-[var(--color-muted)]">
                  Changes save as a draft. Use Update Discord command to push to the server.
                </span>
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={isSaving}
                  className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:opacity-60"
                >
                  {isSaving ? (
                    <CircleNotch size={14} weight="bold" className="animate-spin" />
                  ) : (
                    <FloppyDisk size={14} weight="bold" aria-hidden />
                  )}
                  <span>Save draft</span>
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {visiblePanes.includes("preview") ? (
          <section className={paneShellClass("preview", activePane)}>
            <PaneHeading
              paneId="preview"
              title="Discord preview"
              description="A live read on what members see when they run the command."
              badge={isPublished ? "Synced" : "Needs publish"}
              tooltip="Click a preview field to jump back into the builder and edit it."
            />

            <div className="rounded-[calc(var(--radius-window)+6px)] border border-[color-mix(in_oklab,white_10%,transparent)] bg-[#101115] p-4 text-white shadow-[0_24px_50px_rgba(9,10,16,0.28)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">
                    {title || "Untitled form"}
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    /{commandName || "command"} •{" "}
                    {commandDescription || "No description yet"}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-white/60">
                  {isPublished ? "Published" : "Draft"}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {fields.length === 0 ? (
                  <div className="rounded-[calc(var(--radius-window)+2px)] border border-dashed border-white/12 bg-white/[0.03] px-4 py-6 text-sm text-white/55">
                    Add fields to preview the modal.
                  </div>
                ) : (
                  fields.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => focusField(field.id)}
                      className={
                        field.id === selectedFieldId
                          ? "rounded-[calc(var(--radius-window)+2px)] border border-[color-mix(in_oklab,var(--color-accent)_55%,white)] bg-white/[0.08] px-4 py-3 text-left transition-colors"
                          : "rounded-[calc(var(--radius-window)+2px)] border border-white/10 bg-white/[0.05] px-4 py-3 text-left transition-colors hover:border-white/25"
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {field.label || "Untitled field"}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                          {field.type}
                        </span>
                      </div>
                      <div className="mt-2 rounded-[var(--radius-window)] border border-white/10 bg-black/25 px-3 py-3 text-sm text-white/40">
                        {field.placeholder || "Input placeholder"}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="text-sm font-medium text-[var(--color-ink)]">
                Workspace tips
              </p>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-[var(--color-muted)]">
                <li>Toggle panes above to work with one, two, or all three views.</li>
                <li>Tap a preview field to jump back into the field editor.</li>
                <li>On mobile, use the pane switcher to stay focused on one task.</li>
              </ul>
            </div>
          </section>
        ) : null}
        </div>
        ) : null}
      </div>
    </div>
  );
}

// Maps each field type to its glyph so the picker and field rows share a
// vocabulary the admin can scan at a glance.
const FIELD_TYPE_ICONS: Record<FieldType, typeof TextT> = {
  short: TextT,
  paragraph: TextAlignLeft,
  email: Envelope,
  code: CodeIcon,
  select: ListBullets,
  yes_no: ToggleRight,
  checkbox: CheckSquare,
  number: Hash,
};

function FieldTypePicker({
  onAdd,
  disabled,
}: {
  onAdd: (type: FieldType) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  const handlePick = (type: FieldType) => {
    setOpen(false);
    onAdd(type);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3.5 py-2 text-sm font-medium text-[var(--color-surface)] transition-transform duration-150 active:translate-y-px disabled:opacity-50"
      >
        <Plus size={14} weight="bold" aria-hidden />
        <span>Add field</span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
            aria-label="Close picker"
          />
          <div
            role="menu"
            className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-window)]"
          >
            <ul className="flex flex-col py-1">
              {FIELD_TYPE_META.map((meta) => {
                const Icon = FIELD_TYPE_ICONS[meta.value];
                return (
                  <li key={meta.value}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handlePick(meta.value)}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[color-mix(in_oklab,var(--color-bg)_60%,white)]"
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] text-[var(--color-ink)]"
                      >
                        <Icon size={14} weight="bold" />
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium text-[var(--color-ink)]">
                          {meta.label}
                        </span>
                        <span className="text-xs text-[var(--color-muted)]">
                          {meta.hint}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}

function FieldEditor({
  field,
  onChange,
}: {
  field: FormField;
  onChange: (updater: (current: FormField) => FormField) => void;
}) {
  const meta = fieldTypeMeta(field.type);

  const handleTypeChange = (nextType: FieldType) => {
    if (nextType === field.type) return;
    onChange((current) => {
      const nextMeta = fieldTypeMeta(nextType);
      const isNumber = nextType === "number";
      return {
        ...current,
        type: nextType,
        helperText: current.helperText ?? defaultHelperText(nextType),
        options: nextMeta.hasOptions
          ? (current.options ?? defaultOptions(nextType))
          : nextType === "yes_no"
            ? defaultOptions("yes_no")
            : undefined,
        minLength: nextMeta.hasLength ? current.minLength : undefined,
        maxLength: nextMeta.hasLength
          ? (current.maxLength ?? defaultMaxLength(nextType))
          : undefined,
        // Number fields get their own placeholder use (numeric example)
        // but we preserve whatever the admin typed on the previous type.
        placeholder:
          nextMeta.hasLength || isNumber ? current.placeholder : undefined,
        // Strip number-only knobs when leaving the number type so we never
        // persist stale bounds on a text field.
        minValue: isNumber ? current.minValue : undefined,
        maxValue: isNumber ? current.maxValue : undefined,
        currencyUnit: isNumber ? current.currencyUnit : undefined,
      };
    });
  };

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-[var(--color-border)] pt-4">
      <div className="grid gap-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--color-ink)]">Field type</span>
          <select
            value={field.type}
            onChange={(event) => handleTypeChange(event.target.value as FieldType)}
            className="min-h-10 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
          >
            {FIELD_TYPE_META.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label} — {entry.hint}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-[var(--color-ink)]">Label</span>
        <input
          value={field.label}
          onChange={(event) =>
            onChange((current) => ({ ...current, label: event.target.value }))
          }
          className="min-h-10 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
          maxLength={80}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-[var(--color-ink)]">
          Helper text
          <span className="ml-2 font-normal text-[var(--color-muted)]">
            Shown below the input in Discord.
          </span>
        </span>
        <input
          value={field.helperText ?? ""}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              helperText: event.target.value || undefined,
            }))
          }
          className="min-h-10 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
          maxLength={100}
          placeholder="Optional"
        />
      </label>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              required: event.target.checked,
            }))
          }
        />
        <span className="font-medium text-[var(--color-ink)]">Required</span>
        <span className="text-xs text-[var(--color-muted)]">
          Blocks submission if left empty.
        </span>
      </label>

      {meta.hasLength ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--color-ink)]">
              Placeholder
            </span>
            <input
              value={field.placeholder ?? ""}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  placeholder: event.target.value || undefined,
                }))
              }
              className="min-h-10 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
              maxLength={100}
              placeholder="Optional"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-[var(--color-ink)]">Min</span>
              <input
                type="number"
                min={0}
                max={4000}
                value={field.minLength ?? ""}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    minLength: numberOrUndefined(event.target.value),
                  }))
                }
                className="min-h-10 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-[var(--color-ink)]">Max</span>
              <input
                type="number"
                min={1}
                max={4000}
                value={field.maxLength ?? ""}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    maxLength: numberOrUndefined(event.target.value),
                  }))
                }
                className="min-h-10 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
              />
            </label>
          </div>
        </div>
      ) : null}

      {meta.hasNumberBounds ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--color-ink)]">
              Placeholder
            </span>
            <input
              value={field.placeholder ?? ""}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  placeholder: event.target.value || undefined,
                }))
              }
              className="min-h-10 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
              maxLength={100}
              placeholder="Optional, e.g. 250"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--color-ink)]">
              Currency unit
              <span className="ml-2 font-normal text-[var(--color-muted)]">
                Optional, e.g. USD or credits
              </span>
            </span>
            <input
              value={field.currencyUnit ?? ""}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  currencyUnit: event.target.value || undefined,
                }))
              }
              className="min-h-10 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
              maxLength={16}
              placeholder="USD"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--color-ink)]">Min value</span>
            <input
              type="number"
              value={field.minValue ?? ""}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  minValue: numberOrUndefined(event.target.value),
                }))
              }
              className="min-h-10 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
              placeholder="Leave blank for no minimum"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--color-ink)]">Max value</span>
            <input
              type="number"
              value={field.maxValue ?? ""}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  maxValue: numberOrUndefined(event.target.value),
                }))
              }
              className="min-h-10 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
              placeholder="Leave blank for no maximum"
            />
          </label>
        </div>
      ) : null}

      {field.type === "select" ? (
        <OptionsEditor
          options={field.options ?? []}
          minOptions={2}
          maxOptions={25}
          onChange={(nextOptions) =>
            onChange((current) => ({ ...current, options: nextOptions }))
          }
        />
      ) : null}

      {field.type === "checkbox" ? (
        <CheckboxOptionEditor
          option={field.options?.[0] ?? { id: "confirm", label: "I agree" }}
          onChange={(nextOption) =>
            onChange((current) => ({ ...current, options: [nextOption] }))
          }
        />
      ) : null}

      {field.type === "yes_no" ? (
        <p className="rounded-[calc(var(--radius-window)-2px)] border border-dashed border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-3 py-2 text-xs text-[var(--color-muted)]">
          Submitters pick Yes or No from a dropdown. No extra config needed.
        </p>
      ) : null}
    </div>
  );
}

function OptionsEditor({
  options,
  minOptions,
  maxOptions,
  onChange,
}: {
  options: Array<FieldOption>;
  minOptions: number;
  maxOptions: number;
  onChange: (next: Array<FieldOption>) => void;
}) {
  const addOption = () => {
    if (options.length >= maxOptions) return;
    const index = options.length + 1;
    onChange([
      ...options,
      { id: `option_${Date.now().toString(36)}`, label: `Option ${index}` },
    ]);
  };

  const updateOption = (optionId: string, patch: Partial<FieldOption>) => {
    onChange(
      options.map((option) =>
        option.id === optionId ? { ...option, ...patch } : option,
      ),
    );
  };

  const removeOption = (optionId: string) => {
    if (options.length <= minOptions) return;
    onChange(options.filter((option) => option.id !== optionId));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-ink)]">
          Options
        </span>
        <span className="text-xs text-[var(--color-muted)]">
          {options.length}/{maxOptions}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {options.map((option) => (
          <li
            key={option.id}
            className="flex items-center gap-2 rounded-[calc(var(--radius-window)-2px)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] px-2 py-1.5"
          >
            <input
              value={option.label}
              onChange={(event) =>
                updateOption(option.id, { label: event.target.value })
              }
              className="min-h-9 flex-1 rounded-[calc(var(--radius-window)-4px)] border border-transparent bg-transparent px-2 py-1 text-sm outline-none focus:border-[var(--color-border)]"
              maxLength={80}
              placeholder="Option label"
            />
            <button
              type="button"
              onClick={() => removeOption(option.id)}
              disabled={options.length <= minOptions}
              aria-label="Remove option"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-[var(--color-muted)] transition-colors hover:border-[var(--color-border)] hover:text-[var(--color-danger)] disabled:opacity-40"
            >
              <X size={12} weight="bold" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={addOption}
        disabled={options.length >= maxOptions}
        className="inline-flex min-h-9 items-center gap-2 self-start rounded-[var(--radius-window)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:opacity-50"
      >
        <Plus size={12} weight="bold" aria-hidden />
        <span>Add option</span>
      </button>
    </div>
  );
}

function CheckboxOptionEditor({
  option,
  onChange,
}: {
  option: FieldOption;
  onChange: (next: FieldOption) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-[var(--color-ink)]">
        Confirmation label
      </span>
      <input
        value={option.label}
        onChange={(event) =>
          onChange({ ...option, label: event.target.value })
        }
        className="min-h-10 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
        maxLength={80}
        placeholder="I agree to the rules"
      />
      <span className="text-xs text-[var(--color-muted)]">
        Shown as a single-choice confirmation the member must pick before submitting.
      </span>
    </label>
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
  icon,
  title,
  description,
  tone,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone: "ok" | "error" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "border-[color-mix(in_oklab,var(--color-success)_45%,var(--color-border))] text-[var(--color-success)]"
      : tone === "error"
        ? "border-[color-mix(in_oklab,var(--color-danger)_45%,var(--color-border))] text-[var(--color-danger)]"
        : "border-[var(--color-border)] text-[var(--color-ink)]";

  return (
    <div
      className={`flex items-start gap-3 rounded-[var(--radius-window)] border ${toneClass} bg-[var(--color-surface)] px-4 py-3`}
    >
      <span className="mt-0.5">{icon}</span>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-[var(--color-muted)]">{description}</p>
      </div>
    </div>
  );
}

function PaneHeading({
  paneId,
  title,
  description,
  badge,
  tooltip,
  action,
}: {
  paneId: PaneId;
  title: string;
  description: string;
  badge?: string;
  tooltip: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[calc(var(--radius-window)+2px)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_72%,white)] text-[var(--color-ink)]">
            <PaneIcon paneId={paneId} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--color-ink)]">
                {title}
              </h2>
              {badge ? (
                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
                  {badge}
                </span>
              ) : null}
              <Tooltip content={tooltip}>
                <span
                  tabIndex={0}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
                >
                  <Question size={11} weight="bold" aria-hidden />
                </span>
              </Tooltip>
            </div>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

function RolePicker({
  title,
  description,
  roles,
  selectedRoleIds,
  onToggle,
}: {
  title: string;
  description: string;
  roles: Array<GuildRole>;
  selectedRoleIds: Array<string>;
  onToggle: (roleId: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <div>
        <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,white)] p-3">
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => {
            const selected = selectedRoleIds.includes(role.discordRoleId);
            return (
              <button
                key={role.discordRoleId}
                type="button"
                onClick={() => onToggle(role.discordRoleId)}
                className={
                  selected
                    ? "inline-flex items-center gap-2 rounded-full border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-1.5 text-sm text-[var(--color-surface)]"
                    : "inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
                }
              >
                <span
                  className="inline-flex h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      role.color && role.color !== 0
                        ? `#${role.color.toString(16).padStart(6, "0")}`
                        : "var(--color-muted)",
                  }}
                />
                <span>{role.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PaneToggleButton({
  paneId,
  visible,
  onToggle,
}: {
  paneId: PaneId;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip content={paneTooltip(paneId)}>
      <button
        type="button"
        onClick={onToggle}
        className={
          visible
            ? "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-2 text-sm font-medium text-[var(--color-surface)]"
            : "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
        }
      >
        <PaneIcon paneId={paneId} />
        <span>{paneLabel(paneId)}</span>
        {visible ? (
          <Eye size={14} weight="bold" aria-hidden />
        ) : (
          <EyeSlash size={14} weight="bold" aria-hidden />
        )}
      </button>
    </Tooltip>
  );
}

function PaneIcon({ paneId }: { paneId: PaneId }) {
  switch (paneId) {
    case "command":
      return <SlidersHorizontal size={16} weight="bold" aria-hidden />;
    case "fields":
      return <ListBullets size={16} weight="bold" aria-hidden />;
    case "preview":
      return <Eye size={16} weight="bold" aria-hidden />;
  }
}

function paneLabel(paneId: PaneId) {
  switch (paneId) {
    case "command":
      return "Command";
    case "fields":
      return "Fields";
    case "preview":
      return "Preview";
  }
}

function paneTooltip(paneId: PaneId) {
  switch (paneId) {
    case "command":
      return "Show or hide the command settings pane.";
    case "fields":
      return "Show or hide the modal fields builder pane.";
    case "preview":
      return "Show or hide the live Discord preview pane.";
  }
}

function bottomRowGridClass(visiblePaneCount: number) {
  switch (visiblePaneCount) {
    case 1:
      return "grid gap-4";
    default:
      return "grid gap-4 xl:grid-cols-[minmax(24rem,1.2fr)_minmax(18rem,0.9fr)]";
  }
}

function paneShellClass(paneId: PaneId, activePane: PaneId) {
  const isActiveOnMobile = paneId === activePane;
  const stickyClass =
    paneId === "preview" ? "xl:sticky xl:top-28 xl:self-start" : "";

  return `${isActiveOnMobile ? "flex" : "hidden"} ${stickyClass} min-h-[26rem] min-w-0 flex-col gap-5 rounded-[calc(var(--radius-window)+6px)] border border-[color-mix(in_oklab,var(--color-ink)_8%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-surface)_92%,var(--color-bg))] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.06)] lg:flex`;
}

function createFieldId(): string {
  return `field_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function defaultFieldLabel(type: FieldType): string {
  switch (type) {
    case "paragraph":
      return "Long answer";
    case "email":
      return "Email";
    case "code":
      return "Code snippet";
    case "select":
      return "Pick one";
    case "yes_no":
      return "Yes or no";
    case "checkbox":
      return "I agree";
    default:
      return "Short answer";
  }
}

function defaultHelperText(type: FieldType): string | undefined {
  if (type === "email")
    return "For contact only, not shown on the form.";
  if (type === "code") return "Paste the full snippet. Formatting is kept.";
  if (type === "number") return "Numeric answer only.";
  return undefined;
}

function defaultMaxLength(type: FieldType): number | undefined {
  switch (type) {
    case "paragraph":
      return 500;
    case "code":
      return 2000;
    case "email":
      return 254;
    case "short":
      return 160;
    default:
      return undefined;
  }
}

function defaultOptions(type: FieldType): Array<FieldOption> | undefined {
  if (type === "yes_no") {
    return [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ];
  }
  if (type === "select") {
    return [
      { id: "option_1", label: "Option 1" },
      { id: "option_2", label: "Option 2" },
    ];
  }
  if (type === "checkbox") {
    return [{ id: "confirm", label: "I agree" }];
  }
  return undefined;
}

function numberOrUndefined(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function createDraftSnapshot(form: {
  title: string;
  commandName: string;
  commandDescription: string;
  description?: string;
  requiresApproval: boolean;
  modQueueChannelId?: string;
  destinationChannelId?: string;
  destinationType?: "text" | "forum";
  forumTagId?: string;
  requiredRoleIds?: Array<string>;
  restrictedRoleIds?: Array<string>;
  modRoleIds?: Array<string>;
  successMessage?: string;
  maxSubmissionsPerUser?: number;
  maxSubmissionsPerDay?: number;
  showModeratorInFooter?: boolean;
  linkSubmitterOnPublish?: boolean;
  ticketMode?: boolean;
  autoCloseInactiveDays?: number;
  fields: Array<FormField>;
}) {
  return JSON.stringify({
    title: form.title,
    commandName: form.commandName,
    commandDescription: form.commandDescription,
    description: form.description ?? "",
    requiresApproval: form.requiresApproval,
    modQueueChannelId: form.modQueueChannelId ?? "",
    destinationChannelId: form.destinationChannelId ?? "",
    destinationType: form.destinationType ?? "",
    forumTagId: form.forumTagId ?? "",
    requiredRoleIds: form.requiredRoleIds ?? [],
    restrictedRoleIds: form.restrictedRoleIds ?? [],
    modRoleIds: form.modRoleIds ?? [],
    successMessage: form.successMessage ?? "",
    maxSubmissionsPerUser: form.maxSubmissionsPerUser ?? null,
    maxSubmissionsPerDay: form.maxSubmissionsPerDay ?? null,
    showModeratorInFooter: form.showModeratorInFooter ?? true,
    linkSubmitterOnPublish: form.linkSubmitterOnPublish ?? true,
    ticketMode: form.ticketMode ?? false,
    autoCloseInactiveDays: form.autoCloseInactiveDays ?? null,
    fields: form.fields,
  });
}

function formatFormError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Could not save the form.";
  }

  if (error.message.includes("command_name_taken")) {
    return "That slash command name is already used in this server.";
  }
  if (error.message.includes("publish_requires_fields")) {
    return "Add at least one field before you publish.";
  }
  if (error.message.includes("too_many_fields")) {
    return "Discord modals allow up to five fields.";
  }
  if (error.message.includes("invalid_command_name")) {
    return "Use 1 to 32 lowercase letters, numbers, or hyphens for the slash command.";
  }
  if (error.message.includes("field_label_required")) {
    return "Every field needs a label.";
  }
  if (error.message.includes("field_length_range_invalid")) {
    return "A field has a minimum length greater than its maximum length.";
  }
  if (error.message.includes("mod_queue_channel_invalid")) {
    return "Pick a text channel for the approval queue.";
  }
  if (error.message.includes("required_role_invalid")) {
    return "One of the required roles is no longer available. Refresh roles and choose again.";
  }
  if (error.message.includes("restricted_role_invalid")) {
    return "One of the blocked roles is no longer available. Refresh roles and choose again.";
  }
  if (error.message.includes("max_submissions_per_user_invalid")) {
    return "Lifetime limit must be a whole number between 1 and 10000.";
  }
  if (error.message.includes("max_submissions_per_day_invalid")) {
    return "Daily limit must be a whole number between 1 and 10000.";
  }
  if (error.message.includes("success_message_too_long")) {
    return "Success message is too long. Keep it under 500 characters.";
  }
  if (error.message.includes("submission_limit_reached")) {
    return "This member already reached the maximum number of submissions for the form.";
  }
  if (error.message.includes("daily_submission_limit_reached")) {
    return "This member already reached today's submission limit for the form.";
  }
  if (error.message.includes("destination_incomplete")) {
    return "Pick both a destination type and a destination channel.";
  }
  if (error.message.includes("destination_channel_invalid")) {
    return "The selected destination channel does not match the chosen destination type.";
  }
  if (error.message.includes("forum_tag_invalid")) {
    return "That forum tag does not belong to the selected forum channel.";
  }
  if (error.message.includes("forum_tag_requires_forum_destination")) {
    return "Forum tags only work with forum destinations.";
  }
  if (error.message.includes("discord_channels_refresh_failed")) {
    return "Discord channel refresh failed. Check the bot install and server permissions.";
  }
  if (error.message.includes("discord_roles_refresh_failed")) {
    return "Discord role refresh failed. Check the bot install and try again.";
  }
  if (error.message.includes("discord_register_command_failed")) {
    return "Discord rejected the publish request. Double check the bot install and command name.";
  }

  return error.message;
}

function formatChannelLabel(channel: GuildChannel) {
  return channel.parentName ? `${channel.parentName} / #${channel.name}` : `#${channel.name}`;
}

function sortVisiblePanes(panes: Array<PaneId>) {
  return PANE_ORDER.filter((paneId) => panes.includes(paneId));
}

function readVisiblePanes(): Array<PaneId> {
  if (typeof window === "undefined") {
    return PANE_ORDER;
  }

  try {
    const raw = window.localStorage.getItem(VISIBLE_PANES_STORAGE_KEY);
    if (!raw) {
      return PANE_ORDER;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return PANE_ORDER;
    }

    const panes = PANE_ORDER.filter((paneId) => parsed.includes(paneId));
    return panes.length > 0 ? panes : PANE_ORDER;
  } catch {
    return PANE_ORDER;
  }
}

function readActiveMobilePane(): PaneId {
  if (typeof window === "undefined") {
    return "fields";
  }

  const raw = window.localStorage.getItem(ACTIVE_PANE_STORAGE_KEY);
  return raw === "command" || raw === "preview" || raw === "fields"
    ? raw
    : "fields";
}

function writeVisiblePanes(panes: Array<PaneId>) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    VISIBLE_PANES_STORAGE_KEY,
    JSON.stringify(sortVisiblePanes(panes)),
  );
}

function writeActivePane(paneId: PaneId) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACTIVE_PANE_STORAGE_KEY, paneId);
}
