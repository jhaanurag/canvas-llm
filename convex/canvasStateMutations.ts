import { mutation } from "./_generated/server";
import { v } from "convex/values";

/** Maximum nodes per canvas to prevent unbounded growth. */
const MAX_NODES = 200;
/** Maximum connections per canvas. */
const MAX_CONNECTIONS = 500;
/** Maximum context buffer items. */
const MAX_CONTEXT_ITEMS = 50;

const messageValidator = v.object({
  id: v.string(),
  role: v.union(v.literal("user"), v.literal("model")),
  text: v.string(),
  sourceText: v.optional(v.string()),
  timestamp: v.number(),
});

const nodeValidator = v.object({
  id: v.string(),
  type: v.union(v.literal("chat"), v.literal("note"), v.literal("drawing")),
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
  messages: v.array(messageValidator),
  parentId: v.optional(v.string()),
  sourceSelection: v.optional(v.string()),
  color: v.optional(v.string()),
  title: v.optional(v.string()),
  content: v.optional(v.string()),
  initialPrompt: v.optional(v.string()),
  systemPrompt: v.optional(v.string()),
  autoSend: v.optional(v.boolean()),
  hasInitialContext: v.optional(v.boolean()),
});

const connectionValidator = v.object({
  id: v.string(),
  fromId: v.string(),
  toId: v.string(),
  label: v.optional(v.string()),
});

const contextItemValidator = v.object({
  id: v.string(),
  text: v.string(),
  sourceNodeId: v.string(),
});

/**
 * Save (upsert) the canvas state for the authenticated user.
 */
export const save = mutation({
  args: {
    nodes: v.array(nodeValidator),
    connections: v.array(connectionValidator),
    contextBuffer: v.array(contextItemValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to save canvas state.");
    }

    const clerkUserId = identity.subject;

    // Enforce size limits
    const nodes = args.nodes.slice(0, MAX_NODES);
    const connections = args.connections.slice(0, MAX_CONNECTIONS);
    const contextBuffer = args.contextBuffer.slice(0, MAX_CONTEXT_ITEMS);

    const existing = await ctx.db
      .query("canvasStates")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        nodes,
        connections,
        contextBuffer,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("canvasStates", {
        clerkUserId,
        nodes,
        connections,
        contextBuffer,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Clear the canvas state for the authenticated user.
 */
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to clear canvas state.");
    }

    const clerkUserId = identity.subject;

    const existing = await ctx.db
      .query("canvasStates")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
