import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const messageValidator = v.object({
  id: v.string(),
  role: v.union(v.literal("user"), v.literal("model")),
  text: v.string(),
  sourceText: v.optional(v.string()),
  timestamp: v.number(),
  // Attachments are stripped before persisting to keep document size manageable.
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
  // initialAttachments are stripped before persisting.
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
  // Images are stripped before persisting.
});

export default defineSchema({
  canvasStates: defineTable({
    clerkUserId: v.string(),
    nodes: v.array(nodeValidator),
    connections: v.array(connectionValidator),
    contextBuffer: v.array(contextItemValidator),
    updatedAt: v.number(),
  }).index("by_clerk_user_id", ["clerkUserId"]),
});
