import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CircleNotch,
  FilePlus,
  Gear,
  Sparkle,
} from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import { WindowFrame } from "../components/window/WindowFrame";
import { WindowTabs } from "../components/window/WindowTabs";
import { useMe } from "../hooks/useMe";

export function NewForm() {
  const me = useMe();
  const navigate = useNavigate();
  const currentGuild = useQuery(api.guilds.current);
  const createForm = useMutation(api.forms.create);

  const [title, setTitle] = useState("");
  const [commandName, setCommandName] = useState("");
  const [commandDescription, setCommandDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit =
    currentGuild !== undefined &&
    currentGuild !== null &&
    title.trim().length > 0 &&
    commandName.trim().length > 0 &&
    commandDescription.trim().length > 0 &&
    !pending;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentGuild) return;

    setPending(true);
    setError(null);

    try {
      const formId = await createForm({
        guildId: currentGuild._id,
        title,
        commandName,
        commandDescription,
      });
      navigate(`/app/forms/${formId}`);
    } catch (err) {
      setError(formatCreateError(err));
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12">
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
            <h1 className="text-xl font-semibold tracking-tight">New form</h1>
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
        label="forge / forms / new"
        title="Draft a slash command"
        description="Give the command a clear title, a lowercase slash name, and a short description. Routing and fields come next."
      >
        {currentGuild === undefined ? (
          <LoadingState label="Loading connected server" />
        ) : currentGuild === null ? (
          <NoGuildState />
        ) : (
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
              <p className="text-sm font-medium text-[var(--color-ink)]">
                Creating in {currentGuild.name}
              </p>
              <p className="text-sm text-[var(--color-muted)]">
                One form becomes one Discord slash command in this server.
              </p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[var(--color-ink)]">
                Form title
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
                placeholder="Job posting"
                maxLength={80}
              />
              <span className="text-xs text-[var(--color-muted)]">
                Used in the dashboard and as the default forum title template.
              </span>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[var(--color-ink)]">
                Slash command name
              </span>
              <div className="flex items-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
                <span className="mr-1 text-sm text-[var(--color-muted)]">/</span>
                <input
                  value={commandName}
                  onChange={(event) => setCommandName(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder="post-job"
                  maxLength={32}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <span className="text-xs text-[var(--color-muted)]">
                Use 1 to 32 lowercase letters, numbers, or hyphens. No slash.
              </span>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[var(--color-ink)]">
                Command description
              </span>
              <input
                value={commandDescription}
                onChange={(event) => setCommandDescription(event.target.value)}
                className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-ink)]"
                placeholder="Collect a new job listing from a member"
                maxLength={100}
              />
              <span className="text-xs text-[var(--color-muted)]">
                Discord shows this under the slash command picker.
              </span>
            </label>

            {error ? (
              <div className="rounded-[var(--radius-window)] border border-[color-mix(in_oklab,var(--color-danger)_45%,var(--color-border))] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-danger)]">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-[var(--color-surface)] shadow-[var(--shadow-window)] transition-transform duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? (
                  <CircleNotch size={16} weight="bold" className="animate-spin" />
                ) : (
                  <FilePlus size={16} weight="bold" aria-hidden />
                )}
                <span>{pending ? "Creating draft" : "Create draft"}</span>
              </button>

              <div className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)]">
                <Sparkle size={16} weight="bold" aria-hidden />
                <span>Fields, routing, and publish settings come next.</span>
              </div>
            </div>
          </form>
        )}
      </WindowFrame>
    </main>
  );
}

function NoGuildState() {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-window)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-8">
      <h3 className="text-base font-semibold">Connect a Discord server first</h3>
      <p className="max-w-xl text-sm text-[var(--color-muted)]">
        Forms are scoped to a connected server. Install the bot from Settings,
        then come back to draft slash commands.
      </p>
      <div>
        <Link
          to="/app/settings"
          className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-[var(--color-surface)] shadow-[var(--shadow-window)] transition-transform duration-150 active:translate-y-px"
        >
          <Gear size={16} weight="bold" aria-hidden />
          <span>Open settings</span>
        </Link>
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

function formatCreateError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Could not create the form draft.";
  }

  if (error.message.includes("command_name_taken")) {
    return "That slash command name is already used in this server.";
  }
  if (error.message.includes("invalid_command_name")) {
    return "Use 1 to 32 lowercase letters, numbers, or hyphens for the slash command.";
  }
  if (error.message.includes("title_required")) {
    return "Add a title for the form.";
  }
  if (error.message.includes("description_required")) {
    return "Add a short slash command description.";
  }
  if (error.message.includes("guild_not_found")) {
    return "The connected server could not be found. Reconnect it from Settings.";
  }

  return error.message;
}
