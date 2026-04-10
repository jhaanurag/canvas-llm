"use node";

import type { FunctionReference } from "convex/server";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { verifySessionToken } from "./authShared";

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

const canvasStateValidator = v.object({
  nodes: v.array(nodeValidator),
  connections: v.array(connectionValidator),
  contextBuffer: v.array(contextItemValidator),
});
type CanvasMessage = {
  id: string;
  role: "user" | "model";
  text: string;
  sourceText?: string;
  timestamp: number;
};
type CanvasNode = {
  id: string;
  type: "chat" | "note" | "drawing";
  x: number;
  y: number;
  width: number;
  height: number;
  messages: CanvasMessage[];
  parentId?: string;
  sourceSelection?: string;
  color?: string;
  title?: string;
  content?: string;
  initialPrompt?: string;
  systemPrompt?: string;
  autoSend?: boolean;
  hasInitialContext?: boolean;
};
type CanvasConnection = {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
};
type CanvasContextItem = {
  id: string;
  text: string;
  sourceNodeId: string;
};
type CanvasStateResult = {
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  contextBuffer: CanvasContextItem[];
};
const internalApi = internal as unknown as {
  canvasState: {
    getForUserId: FunctionReference<"query", "internal", Record<string, unknown>, CanvasStateResult | null>;
  };
  canvasStateMutations: {
    saveForUserId: FunctionReference<"mutation", "internal", Record<string, unknown>, void>;
  };
};

function requireSessionUser(token: string) {
  const sessionUser = verifySessionToken(token);
  if (!sessionUser) {
    throw new Error("Your session is no longer valid. Please sign in again.");
  }
  return sessionUser;
}

export const load = action({
  args: { token: v.string() },
  returns: v.union(canvasStateValidator, v.null()),
  handler: async (ctx, { token }) => {
    const sessionUser = requireSessionUser(token);
    return await ctx.runQuery(internalApi.canvasState.getForUserId, {
      userId: sessionUser.id,
    });
  },
});

export const save = action({
  args: {
    token: v.string(),
    nodes: v.array(nodeValidator),
    connections: v.array(connectionValidator),
    contextBuffer: v.array(contextItemValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sessionUser = requireSessionUser(args.token);
    await ctx.runMutation(internalApi.canvasStateMutations.saveForUserId, {
      userId: sessionUser.id,
      nodes: args.nodes,
      connections: args.connections,
      contextBuffer: args.contextBuffer,
    });
    return null;
  },
});
