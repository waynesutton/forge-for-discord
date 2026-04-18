import { Link } from "react-router";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  ChatsCircle,
  CircleNotch,
  CursorClick,
  FilePlus,
  Gear,
  Hash,
  Queue,
  TreeStructure,
} from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import { WindowFrame } from "../components/window/WindowFrame";
import { WindowTabs } from "../components/window/WindowTabs";
import { useMe } from "../hooks/useMe";

export function Forms() {
  const me = useMe();
  const currentGuild = useQuery(api.guilds.current);
  const forms =
    useQuery(
      api.forms.list,
      currentGuild ? { guildId: currentGuild._id } : "skip",
    ) ?? [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/app"
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-window)] transition-colors hover:border-[var(--color-ink)]"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={16} weight="bold" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Forms</h1>
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
          { to: "/docs", label: "Docs" },
          { to: "/app/settings", label: "Settings" },
        ]}
      />

      <WindowFrame
        label="forge / forms"
        title="Your forms"
        description="Each form is published as a Discord slash command. Draft one for applications, tickets, bug bounties, or any internal request."
        action={
          currentGuild ? (
            <Link
              to="/app/forms/new"
              className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-2 text-sm font-medium text-[var(--color-surface)] shadow-[var(--shadow-window)] transition-transform duration-150 active:translate-y-px"
            >
              <FilePlus size={16} weight="bold" aria-hidden />
              <span>New form</span>
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-muted)] opacity-70"
            >
              <FilePlus size={16} weight="bold" aria-hidden />
              <span>Connect a server first</span>
            </button>
          )
        }
      >
        {currentGuild === undefined ? (
          <LoadingState label="Loading server" />
        ) : currentGuild === null ? (
          <NoGuildState />
        ) : forms.length === 0 ? (
          <EmptyFormsState guildName={currentGuild.name} />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {forms.map((form) => {
              const destinationLabel =
                form.destinationType === "forum"
                  ? "Forum destination"
                  : form.destinationType === "text"
                    ? "Channel destination"
                    : "No destination";
              const DestinationIcon =
                form.destinationType === "forum" ? TreeStructure : Hash;
              return (
                <li
                  key={form._id}
                  className="group flex flex-col gap-4 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 transition-colors hover:border-[var(--color-ink)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-[var(--color-ink)]">
                        {form.title}
                      </h3>
                      <p className="font-mono text-xs text-[var(--color-muted)]">
                        /{form.commandName}
                      </p>
                    </div>
                    <span
                      className={
                        form.published
                          ? "shrink-0 rounded-full border border-[var(--color-ink)] bg-[var(--color-ink)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-surface)]"
                          : "shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]"
                      }
                    >
                      {form.published ? "Published" : "Draft"}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-sm text-[var(--color-muted)]">
                    {form.commandDescription}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-muted)]">
                    <div className="inline-flex items-center gap-1.5">
                      <ChatsCircle size={14} weight="bold" aria-hidden />
                      <span>{form.fieldCount} fields</span>
                    </div>
                    <span
                      aria-hidden
                      className="h-1 w-1 rounded-full bg-[var(--color-border)]"
                    />
                    <div className="inline-flex items-center gap-1.5">
                      <Queue size={14} weight="bold" aria-hidden />
                      <span>
                        {form.requiresApproval
                          ? "Approval queue"
                          : "Auto publish"}
                      </span>
                    </div>
                    <span
                      aria-hidden
                      className="h-1 w-1 rounded-full bg-[var(--color-border)]"
                    />
                    <div className="inline-flex items-center gap-1.5">
                      <DestinationIcon size={14} weight="bold" aria-hidden />
                      <span>{destinationLabel}</span>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-[var(--color-muted)]">
                      {form.published
                        ? "Update published command from the editor."
                        : "Open the editor to add fields and publish."}
                    </span>
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <Link
                        to={`/app/forms/${form._id}/results`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
                      >
                        <Queue size={14} weight="bold" aria-hidden />
                        <span>Results</span>
                      </Link>
                      <Link
                        to={`/app/forms/${form._id}`}
                        className={
                          form.published
                            ? "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
                            : "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 text-sm font-medium text-[var(--color-surface)] transition-transform duration-150 active:translate-y-px"
                        }
                      >
                        <CursorClick size={14} weight="bold" aria-hidden />
                        <span>{form.published ? "Edit" : "Build form"}</span>
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </WindowFrame>
    </main>
  );
}

function NoGuildState() {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-window)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-8">
      <h3 className="text-base font-semibold">
        Connect a Discord server first
      </h3>
      <p className="max-w-xl text-sm text-[var(--color-muted)]">
        Forms live inside a specific server. Install the Forge bot from
        Settings, then come back to draft your first slash command.
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

function EmptyFormsState({ guildName }: { guildName: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-window)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-8">
      <h3 className="text-base font-semibold">
        No forms in {guildName} yet
      </h3>
      <p className="max-w-xl text-sm text-[var(--color-muted)]">
        Create a draft, add the fields you need, then publish it as a slash
        command. Your first form will show up here.
      </p>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-3 text-sm text-[var(--color-muted)]"
      role="status"
      aria-live="polite"
    >
      <CircleNotch
        size={18}
        weight="bold"
        className="animate-spin"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}
