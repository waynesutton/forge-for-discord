// App-level mirror for Robel auth identities. The auth component owns the
// canonical identity store; this table lets Forge attach role and profile
// lookups without round-tripping through the component on every request.
//
// Important: Robel-issued JWTs only contain `sub` (the `userId|sessionId`
// pair). Email, name, and picture live in the auth component's `User` table.
// `ctx.auth.getUserIdentity().email` is therefore always undefined; every
// email check must read the user row via `auth.user.viewer(ctx)` instead.
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { auth } from "./auth";
import { isAllowedEmail, roleForEmail } from "./lib/access";
import { optionalAllowedViewer, requireAllowedViewer } from "./lib/auth";

// Lightweight access probe. Safe to call before the `users` row is created.
// Reads the Robel user doc (email/name/image) and decides `allowed`. Drives
// the three-way routing in <Protected />: sign-in, access-denied, or
// authenticated workspace.
export const access = query({
  args: {},
  returns: v.object({
    authenticated: v.boolean(),
    allowed: v.boolean(),
    email: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    // Resolve both the raw Convex identity and the component-backed user doc.
    // Either one missing counts as "not signed in" for the dashboard's
    // three-way gate.
    const identity = await ctx.auth.getUserIdentity();
    const viewer = await auth.user.viewer(ctx);
    if (!identity || !viewer) {
      return { authenticated: false, allowed: false };
    }
    const email = typeof viewer.email === "string" ? viewer.email : undefined;
    return {
      authenticated: true,
      allowed: isAllowedEmail(email),
      email,
    };
  },
});

export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      subject: v.string(),
      email: v.string(),
      name: v.string(),
      image: v.optional(v.string()),
      role: v.union(v.literal("admin"), v.literal("owner")),
    }),
  ),
  handler: async (ctx): Promise<Doc<"users"> | null> => {
    const viewer = await optionalAllowedViewer(ctx).catch(() => null);
    if (!viewer) return null;

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_subject", (q) => q.eq("subject", identity.subject))
      .unique();
  },
});

// Upsert the current auth identity into the app-level users table. Called
// once after sign-in from the client. `wayne@convex.dev` is always owner;
// every other @convex.dev address lands as admin. Anything else throws
// ConvexError("access_denied") and no row is written.
export const upsertFromIdentity = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const viewer = await requireAllowedViewer(ctx);
    const email = typeof viewer.email === "string" ? viewer.email : undefined;

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "unauthenticated" });
    }

    const name = typeof viewer.name === "string" ? viewer.name : undefined;
    const image = typeof viewer.image === "string" ? viewer.image : undefined;
    const role = roleForEmail(email);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_subject", (q) => q.eq("subject", identity.subject))
      .unique();

    if (existing) {
      await ctx.db.patch("users", existing._id, {
        email: email!,
        name: name ?? existing.name,
        image: image ?? existing.image,
        role,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      subject: identity.subject,
      email: email!,
      name: name ?? "Unknown",
      image,
      role,
    });
  },
});

// Internal lookup used by actions that already have the Robel `subject` claim
// from `ctx.auth.getUserIdentity()` and need the Forge-level user row (for
// its Convex `_id`, which is what downstream tables foreign-key against).
// Not exposed publicly; actions run outside the reactive query layer so the
// client never calls this directly.
export const lookupBySubject = internalQuery({
  args: { subject: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      email: v.string(),
      role: v.union(v.literal("admin"), v.literal("owner")),
    }),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_subject", (q) => q.eq("subject", args.subject))
      .unique();
    if (!row) return null;
    return { _id: row._id, email: row.email, role: row.role };
  },
});
