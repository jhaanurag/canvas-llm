import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Load the canvas state for the authenticated user.
 * Returns null when no state has been saved yet.
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) {
    //   return null;
    // }

    // const clerkUserId = identity.subject;
    const clerkUserId = "temp-dev-user";

    const state = await ctx.db
      .query("canvasStates")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
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

/**
 * Load canvas state by Clerk user ID (for unauthenticated initial loads via
 * the ConvexHttpClient on the server side — not recommended, prefer the
 * reactive `get` query above).
 */
export const getByUserId = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const state = await ctx.db
      .query("canvasStates")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
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
