import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const emptyState = {
  nodes: [],
  connections: [],
  contextBuffer: [],
};

export const getForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const entry = await ctx.db
      .query("canvasStates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return entry?.state ?? emptyState;
  },
});

export const saveForUser = mutation({
  args: {
    userId: v.string(),
    state: v.object({
      nodes: v.array(v.any()),
      connections: v.array(v.any()),
      contextBuffer: v.optional(v.array(v.any())),
    }),
  },
  handler: async (ctx, { userId, state }) => {
    const existing = await ctx.db
      .query("canvasStates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { state, updatedAt: Date.now() });
      return existing._id;
    }

    return await ctx.db.insert("canvasStates", {
      userId,
      state,
      updatedAt: Date.now(),
    });
  },
});
