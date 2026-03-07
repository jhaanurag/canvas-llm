import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const upsertByName = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const normalized = username.trim();
    if (!normalized) throw new Error("Username is required");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .first();

    if (existing) {
      return { id: existing._id, username: existing.username };
    }

    const id = await ctx.db.insert("users", {
      username: normalized,
      createdAt: Date.now(),
    });

    return { id, username: normalized };
  },
});
