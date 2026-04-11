import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getForUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const state = await ctx.db
      .query("canvasStates")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    const legacyState = state
      ? null
      : await ctx.db
          .query("canvasStates")
          .filter((q) => q.eq(q.field("clerkUserId"), userId))
          .unique();

    const resolvedState = state ?? legacyState;

    if (!resolvedState) {
      return null;
    }

    return {
      nodes: resolvedState.nodes,
      connections: resolvedState.connections,
      contextBuffer: resolvedState.contextBuffer,
    };
  },
});
