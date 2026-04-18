import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CircleNotch,
  CheckCircle,
  DiscordLogo,
  Plus,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import { useMe } from "../hooks/useMe";
import type { Id } from "../../convex/_generated/dataModel";

type ConnectedGuild = {
  _id: Id<"guilds">;
  _creationTime: number;
  discordGuildId: string;
  name: string;
  iconUrl?: string;
  applicationId: string;
  installedByUserId: Id<"users">;
};

// Settings landing page. Phase 2 scope: Discord bot install + installed guild
// list. The Connect button calls the Node action `api.discord.generateInstallUrl`
// which mints a CSRF nonce server-side and returns a ready-to-follow Discord
// OAuth URL. After install, Discord redirects to `/api/discord/install` on the
// Convex deployment which registers the guild and bounces back to this page
// with `?installed=<guildId>` so we can show a success toast.
//
// All ?error=<code> variants from the HTTP action land here too, surfaced as
// a dismissible banner. The list of error codes mirrors http.ts comments.
export function Settings() {
  const me = useMe();
  const [searchParams, setSearchParams] = useSearchParams();
  const installedParam = searchParams.get("installed");
  const errorParam = searchParams.get("error");

  const guilds = useQuery(api.guilds.list) ?? [];
  const generateInstallUrl = useAction(api.discord.generateInstallUrl);
  const disconnectGuild = useMutation(api.guilds.disconnect);
  const [pending, setPending] = useState(false);
  const [disconnectingGuildId, setDisconnectingGuildId] =
    useState<Id<"guilds"> | null>(null);
  const [confirmingGuildId, setConfirmingGuildId] = useState<Id<"guilds"> | null>(
    null,
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [clientSuccess, setClientSuccess] = useState<string | null>(null);

  const handleConnect = async () => {
    setPending(true);
    setClientError(null);
    setClientSuccess(null);
    try {
      const { url } = await generateInstallUrl({});
      window.location.href = url;
    } catch (err) {
      setPending(false);
      setClientError(
        err instanceof Error ? err.message : "Failed to start Discord install.",
      );
    }
  };

  const handleDisconnect = async (guild: {
    _id: Id<"guilds">;
    name: string;
  }) => {
    setDisconnectingGuildId(guild._id);
    setClientError(null);
    setClientSuccess(null);
    try {
      const result = await disconnectGuild({ guildId: guild._id });
      setConfirmingGuildId(null);
      const deletedRows =
        result.deletedForms +
        result.deletedSubmissions +
        result.deletedAuditLog +
        result.deletedCooldowns;
      setClientSuccess(
        deletedRows > 0
          ? `Disconnected ${guild.name}. Forge removed the server and ${deletedRows} related workspace records.`
          : `Disconnected ${guild.name}. Forge removed the server from this workspace.`,
      );
    } catch (err) {
      setClientError(formatDisconnectError(err));
    } finally {
      setDisconnectingGuildId(null);
    }
  };

  const dismissBanner = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("installed");
    next.delete("error");
    setSearchParams(next, { replace: true });
  };

  const successGuild = installedParam
    ? (guilds.find((g) => g._id === (installedParam as Id<"guilds">)) ?? null)
    : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/app"
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-window)] transition-colors hover:border-[var(--color-ink)]"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={16} weight="bold" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
              {me.role} workspace
            </p>
          </div>
        </div>
      </header>

      {successGuild ? (
        <Banner
          tone="ok"
          icon={<CheckCircle size={18} weight="fill" />}
          title={`Connected to ${successGuild.name}`}
          description="Forge can now post slash commands and receive interactions from this server. You can add forms from the dashboard."
          onDismiss={dismissBanner}
        />
      ) : null}

      {errorParam ? (
        <Banner
          tone="error"
          icon={<Warning size={18} weight="fill" />}
          title="Discord install failed"
          description={errorMessage(errorParam)}
          onDismiss={dismissBanner}
        />
      ) : null}

      {clientError ? (
        <Banner
          tone="error"
          icon={<Warning size={18} weight="fill" />}
          title="Could not start install"
          description={clientError}
          onDismiss={() => setClientError(null)}
        />
      ) : null}

      {clientSuccess ? (
        <Banner
          tone="ok"
          icon={<CheckCircle size={18} weight="fill" />}
          title="Server disconnected"
          description={clientSuccess}
          onDismiss={() => setClientSuccess(null)}
        />
      ) : null}

      <section
        className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-window)]"
        aria-labelledby="discord-heading"
      >
        <header className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#f3665c]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#f6c75a]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#58c88f]" aria-hidden />
          <span className="ml-3 text-xs font-medium tracking-wide text-[var(--color-muted)]">
            forge / settings / discord
          </span>
        </header>

        <div className="flex flex-col gap-6 px-8 py-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2
                id="discord-heading"
                className="text-lg font-semibold tracking-tight"
              >
                Discord servers
              </h2>
              <p className="mt-1 max-w-xl text-sm text-[var(--color-muted)]">
                Connect a server so its members can run Forge slash commands.
                You need Manage Server permission on the Discord side, plus
                bot credentials set in Convex env.
              </p>
            </div>
            <button
              type="button"
              onClick={handleConnect}
              disabled={pending || disconnectingGuildId !== null}
              className="inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-[var(--color-surface)] shadow-[var(--shadow-window)] transition-transform duration-150 active:translate-y-px disabled:opacity-60"
            >
              <DiscordLogo size={16} weight="fill" aria-hidden />
              <span>{pending ? "Opening Discord..." : "Connect server"}</span>
            </button>
          </div>

          {guilds.length === 0 ? (
            <EmptyGuilds />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)]">
              {guilds.map((guild) => (
                <GuildRow
                  key={guild._id}
                  guild={guild}
                  busy={pending || disconnectingGuildId !== null}
                  confirmingGuildId={confirmingGuildId}
                  disconnectingGuildId={disconnectingGuildId}
                  onToggleConfirm={() =>
                    setConfirmingGuildId((current) =>
                      current === guild._id ? null : guild._id,
                    )
                  }
                  onCancelConfirm={() => setConfirmingGuildId(null)}
                  onDisconnect={() => void handleDisconnect(guild)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function EmptyGuilds() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-window)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]">
        <Plus size={18} weight="bold" color="var(--color-muted)" />
      </span>
      <p className="max-w-sm text-sm text-[var(--color-muted)]">
        No servers connected yet. Click Connect server to install the Forge
        bot. Discord will ask which server to add it to, then bring you back
        here when it's done.
      </p>
    </div>
  );
}

function GuildRow({
  guild,
  busy,
  confirmingGuildId,
  disconnectingGuildId,
  onToggleConfirm,
  onCancelConfirm,
  onDisconnect,
}: {
  guild: ConnectedGuild;
  busy: boolean;
  confirmingGuildId: Id<"guilds"> | null;
  disconnectingGuildId: Id<"guilds"> | null;
  onToggleConfirm: () => void;
  onCancelConfirm: () => void;
  onDisconnect: () => void;
}) {
  // Routing (approval queue, destination channel, forum tag) is configured
  // per form inside the form editor's Command settings pane. We intentionally
  // do not mirror those controls here so there is one source of truth.

  return (
    <li className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center gap-4">
        {guild.iconUrl ? (
          <img
            src={guild.iconUrl}
            alt=""
            className="h-10 w-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] object-cover"
          />
        ) : (
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-ink)]"
            aria-hidden
          >
            {guild.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-medium text-[var(--color-ink)]">
            {guild.name}
          </span>
          <span className="font-mono text-xs text-[var(--color-muted)]">
            {guild.discordGuildId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-muted)]">
            Connected
          </span>
          <button
            type="button"
            onClick={onToggleConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[color-mix(in_oklab,var(--color-danger)_35%,var(--color-border))] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-danger)_6%,white)] disabled:opacity-60"
          >
            <Trash size={14} weight="bold" aria-hidden />
            <span>Disconnect</span>
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        Channels, approval queue, and forum tags are set per form in the
        editor under Command settings.
      </p>

      {confirmingGuildId === guild._id ? (
        <div className="rounded-[var(--radius-window)] border border-[color-mix(in_oklab,var(--color-danger)_35%,var(--color-border))] bg-[var(--color-surface)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--color-ink)]">
            Disconnect {guild.name} from Forge?
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            This deletes every form, submission, and audit row tied to this
            server. It can't be undone.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onCancelConfirm}
              disabled={disconnectingGuildId === guild._id}
              className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={disconnectingGuildId !== null}
              className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-danger)] bg-[var(--color-danger)] px-3 py-2 text-xs font-medium text-[var(--color-surface)] transition-transform duration-150 active:translate-y-px disabled:opacity-60"
            >
              {disconnectingGuildId === guild._id ? (
                <CircleNotch
                  size={14}
                  weight="bold"
                  className="animate-spin"
                  aria-hidden
                />
              ) : (
                <Trash size={14} weight="bold" aria-hidden />
              )}
              <span>
                {disconnectingGuildId === guild._id
                  ? "Disconnecting..."
                  : "Disconnect server"}
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

type BannerTone = "ok" | "error";

function Banner({
  tone,
  icon,
  title,
  description,
  onDismiss,
}: {
  tone: BannerTone;
  icon: React.ReactNode;
  title: string;
  description: string;
  onDismiss: () => void;
}) {
  const toneClass =
    tone === "ok"
      ? "border-[color-mix(in_oklab,var(--color-success)_45%,var(--color-border))] text-[var(--color-success)]"
      : "border-[color-mix(in_oklab,var(--color-danger)_45%,var(--color-border))] text-[var(--color-danger)]";
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-[var(--radius-window)] border ${toneClass} bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-window)]`}
    >
      <span className="mt-0.5">{icon}</span>
      <div className="flex flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-[var(--color-muted)]">{description}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs text-[var(--color-muted)] underline-offset-2 hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case "access_denied":
      return "You cancelled the install on Discord. Nothing changed.";
    case "invalid_state":
      return "That install link expired or was used twice. Start a fresh one from this page.";
    case "missing_params":
      return "Discord didn't return the expected info. Try the install once more.";
    case "server_not_configured":
      return "Convex env is missing DISCORD_BOT_TOKEN, DISCORD_PUBLIC_KEY, or DISCORD_APPLICATION_ID. Set them and retry.";
    case "oauth_exchange_failed":
      return "Discord rejected the install token exchange. Check the OAuth client secret and redirect URL, then retry.";
    case "oauth_register_failed":
      return "Forge couldn't finish recording the install. Check the Convex logs for details and retry.";
    default:
      return `Install failed: ${code}`;
  }
}

function formatDisconnectError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Couldn't disconnect the server. Try again in a moment.";
  }

  if (error.message.includes("guild_not_found")) {
    return "This server is already disconnected.";
  }
  if (error.message.includes("unauthenticated")) {
    return "Your session expired. Sign in again, then retry.";
  }
  if (error.message.includes("access_denied")) {
    return "You don't have permission to disconnect this server.";
  }

  return error.message;
}

