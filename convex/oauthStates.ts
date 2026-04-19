// Short-lived CSRF nonce storage for the Discord bot install flow.
//
// Flow:
//   1. The dashboard calls `actions.discord.generateInstallUrl` (Node action).
//   2. That action calls `oauthStates.create` internally to mint a row.
//   3. The user bounces to Discord; Discord redirects back to
//      `/api/discord/install?state=<nonce>&code=<...>&guild_id=<...>`.
//   4. The HTTP action calls `oauthStates.consume` which verifies the nonce,
//      returns the bound `userId`, and deletes the row in the same tx.
//
// Nonces expire after 10 minutes. The `gcExpired` internal mutation is safe
// to run from a cron later; for now the consume path sweeps opportunistically.

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const STATE_TTL_MS = 10 * 60 * 1000;

export const create = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.literal("discord_install"),
    returnOrigin: v.optional(v.string()),
  },
  returns: v.object({
    state: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const state = cryptoRandomToken();
    const expiresAt = Date.now() + STATE_TTL_MS;
    await ctx.db.insert("oauthStates", {
      state,
      userId: args.userId,
      kind: args.kind,
      expiresAt,
      returnOrigin: args.returnOrigin,
    });
    return { state, expiresAt };
  },
});

// Single-use: reads the row, deletes it, and returns the bound userId.
// Returns null if the state is unknown or expired; the caller is expected
// to treat null as "reject this request".
export const consume = internalMutation({
  args: {
    state: v.string(),
    kind: v.literal("discord_install"),
  },
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      returnOrigin: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<{
    userId: Id<"users">;
    returnOrigin: string | null;
  } | null> => {
    const row = await ctx.db
      .query("oauthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();
    if (!row) return null;
    if (row.kind !== args.kind) return null;
    await ctx.db.delete("oauthStates", row._id);
    if (row.expiresAt < Date.now()) return null;
    return { userId: row.userId, returnOrigin: row.returnOrigin ?? null };
  },
});

// Opportunistic GC. Can be scheduled from a cron later.
export const gcExpired = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("oauthStates")
      .withIndex("by_expiresat", (q) => q.lt("expiresAt", now))
      .take(100);
    for (const row of stale) {
      await ctx.db.delete("oauthStates", row._id);
    }
    return stale.length;
  },
});

// Web Crypto is available in the Convex runtime; no Node import needed here
// so this helper can live in a V8 mutation file.
function cryptoRandomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
