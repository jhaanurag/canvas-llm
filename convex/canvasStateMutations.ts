import { internalMutation } from "./_generated/server";
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

export const saveForUserId = internalMutation({
  args: {
    userId: v.string(),
    nodes: v.array(nodeValidator),
    connections: v.array(connectionValidator),
    contextBuffer: v.array(contextItemValidator),
  },
  handler: async (ctx, args) => {
    const nodes = args.nodes.slice(0, MAX_NODES);
    const connections = args.connections.slice(0, MAX_CONNECTIONS);
    const contextBuffer = args.contextBuffer.slice(0, MAX_CONTEXT_ITEMS);

    const existing = await ctx.db
      .query("canvasStates")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    const legacyExisting = existing
      ? null
      : await ctx.db
          .query("canvasStates")
          .filter((q) => q.eq(q.field("clerkUserId"), args.userId))
          .unique();

    const resolvedExisting = existing ?? legacyExisting;

    if (resolvedExisting) {
      await ctx.db.patch(resolvedExisting._id, {
        userId: args.userId,
        clerkUserId: undefined,
        nodes,
        connections,
        contextBuffer,
        updatedAt: Date.now(),
      });
      return;
    }

    await ctx.db.insert("canvasStates", {
      userId: args.userId,
      nodes,
      connections,
      contextBuffer,
      updatedAt: Date.now(),
    });
  },
});

export const clearForUserId = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query("canvasStates")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
