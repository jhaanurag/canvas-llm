import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { normalizeIdentifier, normalizeUsername } from "./authUtils";

export const getUserByIdentifier = internalQuery({
  args: { identifier: v.string() },
  handler: async (ctx, { identifier }) => {
    const normalized = normalizeIdentifier(identifier);
    const byEmail = await ctx.db
      .query("users")
      .withIndex("by_email_lower", (q) => q.eq("emailLower", normalized))
      .unique();

    if (byEmail) {
      return byEmail;
    }

    return await ctx.db
      .query("users")
      .withIndex("by_username_lower", (q) => q.eq("usernameLower", normalized))
      .unique();
  },
});

export const getUserById = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId as never);
  },
});

export const createUser = internalMutation({
  args: {
    username: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
  },
  handler: async (ctx, args) => {
    const usernameLower = normalizeUsername(args.username);
    const emailLower = normalizeIdentifier(args.email);

    const existingByUsername = await ctx.db
      .query("users")
      .withIndex("by_username_lower", (q) => q.eq("usernameLower", usernameLower))
      .unique();
    if (existingByUsername) {
      throw new Error("That username is already taken.");
    }

    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email_lower", (q) => q.eq("emailLower", emailLower))
      .unique();
    if (existingByEmail) {
      throw new Error("That email is already registered.");
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      username: args.username,
      usernameLower,
      email: args.email,
      emailLower,
      passwordHash: args.passwordHash,
      passwordSalt: args.passwordSalt,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: userId,
      username: args.username,
      email: args.email,
    };
  },
});
