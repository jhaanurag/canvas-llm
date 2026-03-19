import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getForUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const state = await ctx.db
      .query("canvasStates")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!state) {
      return null;
    }

    return {
      nodes: state.nodes,
      connections: state.connections,
      contextBuffer: state.contextBuffer,
    };
  },
});
