import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import {
  BookOpen,
  DiscordLogo,
  FileText,
  Gear,
  Lightning,
  SignOut,
} from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../hooks/useAuth";
import { useMe } from "../hooks/useMe";

// Phase 1 placeholder. Phase 2 replaces this with the full dashboard (forms
// list, mod queue, audit log). Today it:
//   - Confirms the round-trip works (GitHub OAuth → JWT → users.me).
//   - Surfaces the first guild-connected state so admins know what to do next.
//   - Links to /app/settings for the Discord install flow.
export function Dashboard() {
  const me = useMe();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const currentGuild = useQuery(api.guilds.current);
  const [pending, setPending] = useState(false);

  // Navigate to `/` immediately so the user leaves the `/app` subtree before
  // any pending access-query refetch resolves. Without this step the Protected
  // route can briefly see `{ authenticated: false, allowed: false }` from
  // `api.users.access` while the Robel `isAuthenticated` flag is still true,
  // which used to flash the access-denied screen on the way out.
  const handleSignOut = async () => {
    setPending(true);
    navigate("/", { replace: true });
    try {
      await signOut();
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-window)]">
            <Lightning size={20} weight="fill" color="var(--color-accent)" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Forge</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
              {me.role} workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
          >
            <BookOpen size={16} weight="bold" aria-hidden />
            <span>Docs</span>
          </Link>
          <Link
            to="/app/settings"
            className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
          >
            <Gear size={16} weight="bold" aria-hidden />
            <span>Settings</span>
          </Link>
          <div className="text-right">
            <p className="text-sm font-medium">{me.name}</p>
            <p className="text-xs text-[var(--color-muted)]">{me.email}</p>
          </div>
          {me.image ? (
            <img
              src={me.image}
              alt=""
              className="h-9 w-9 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] object-cover"
            />
          ) : null}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:opacity-60"
          >
            <SignOut size={16} weight="bold" aria-hidden />
            <span>{pending ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      </header>

      {currentGuild === undefined ? null : currentGuild === null ? (
        <NotConnectedBanner />
      ) : (
        <ConnectedBanner guild={currentGuild} />
      )}

      <section className="rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-window)]">
        <h2 className="text-lg font-semibold">Jump back in</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Pick a workspace to open.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            to="/app/forms"
            className="flex items-start gap-3 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition-colors hover:border-[var(--color-ink)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)]">
              <FileText size={18} weight="bold" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--color-ink)]">
                Forms
              </span>
              <span className="text-sm text-[var(--color-muted)]">
                Build slash commands and review submissions for your server.
              </span>
            </span>
          </Link>

          <Link
            to="/app/settings"
            className="flex items-start gap-3 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition-colors hover:border-[var(--color-ink)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)]">
              <Gear size={18} weight="bold" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--color-ink)]">
                Settings
              </span>
              <span className="text-sm text-[var(--color-muted)]">
                Connect a Discord server or disconnect one you no longer need.
              </span>
            </span>
          </Link>

          <Link
            to="/docs"
            className="flex items-start gap-3 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition-colors hover:border-[var(--color-ink)] sm:col-span-2"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)]">
              <BookOpen size={18} weight="bold" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--color-ink)]">
                Docs
              </span>
              <span className="text-sm text-[var(--color-muted)]">
                Setup guide, Discord bot permissions, auth rules, and deploy
                notes with copy ready markdown.
              </span>
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}

function NotConnectedBanner() {
  return (
    <section
      className="flex items-center justify-between gap-6 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-[var(--shadow-window)]"
      aria-labelledby="connect-heading"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <DiscordLogo size={18} weight="fill" color="var(--color-accent)" />
        </span>
        <div>
          <h2 id="connect-heading" className="text-sm font-semibold">
            Connect a Discord server to get started
          </h2>
          <p className="text-sm text-[var(--color-muted)]">
            Every form becomes a slash command. Install the Forge bot into
            your server, then come back here to build.
          </p>
        </div>
      </div>
      <Link
        to="/app/settings"
        className="inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-[var(--color-surface)] shadow-[var(--shadow-window)] transition-transform duration-150 active:translate-y-px"
      >
        Open settings
      </Link>
    </section>
  );
}

function ConnectedBanner({
  guild,
}: {
  guild: { name: string; iconUrl?: string; discordGuildId: string };
}) {
  return (
    <section
      className="flex items-center gap-4 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4 shadow-[var(--shadow-window)]"
      aria-labelledby="current-guild-heading"
    >
      {guild.iconUrl ? (
        <img
          src={guild.iconUrl}
          alt=""
          className="h-12 w-12 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] object-cover"
        />
      ) : (
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] text-base font-semibold"
          aria-hidden
        >
          {guild.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="flex flex-1 flex-col">
        <p
          id="current-guild-heading"
          className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]"
        >
          Connected server
        </p>
        <p className="text-sm font-semibold text-[var(--color-ink)]">
          {guild.name}
        </p>
      </div>
      <Link
        to="/app/settings"
        className="inline-flex items-center gap-2 rounded-[var(--radius-window)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
      >
        <Gear size={16} weight="bold" aria-hidden />
        <span>Manage</span>
      </Link>
    </section>
  );
}
