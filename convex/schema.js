import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    createdAt: v.number(),
  }).index("by_username", ["username"]),
  canvasStates: defineTable({
    userId: v.string(),
    state: v.object({
      nodes: v.array(v.any()),
      connections: v.array(v.any()),
      contextBuffer: v.optional(v.array(v.any())),
    }),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
