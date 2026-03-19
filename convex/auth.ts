"use node";

import type { FunctionReference } from "convex/server";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  createPasswordRecord,
  createSessionToken,
  isValidEmail,
  isValidUsername,
  normalizeIdentifier,
  normalizeUsername,
  verifyPassword,
  verifySessionToken,
} from "./authShared";

const publicUserValidator = v.object({
  id: v.string(),
  username: v.string(),
  email: v.string(),
});
const internalApi = internal as unknown as {
  auth: {
    createUser: FunctionReference<"mutation", "internal", Record<string, unknown>, {
      id: string;
      username: string;
      email: string;
    }>;
    getUserByIdentifier: FunctionReference<"query", "internal", Record<string, unknown>, {
      _id: string;
      username: string;
      email: string;
      passwordSalt: string;
      passwordHash: string;
    } | null>;
    getUserById: FunctionReference<"query", "internal", Record<string, unknown>, {
      _id: string;
      username: string;
      email: string;
    } | null>;
  };
};

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

export const register = action({
  args: {
    username: v.string(),
    email: v.string(),
    password: v.string(),
  },
  returns: v.object({
    token: v.string(),
    user: publicUserValidator,
  }),
  handler: async (ctx, args) => {
    const username = args.username.trim();
    const email = args.email.trim().toLowerCase();
    const password = args.password;

    if (!isValidUsername(username)) {
      throw new Error("Username must be 3-24 characters and use only letters, numbers, or underscores.");
    }
    if (!isValidEmail(email)) {
      throw new Error("Enter a valid email address.");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const { salt, hash } = createPasswordRecord(password);
    const user = await ctx.runMutation(internalApi.auth.createUser, {
      username,
      email,
      passwordHash: hash,
      passwordSalt: salt,
    });

    return {
      token: createSessionToken(user),
      user,
    };
  },
});

export const login = action({
  args: {
    identifier: v.string(),
    password: v.string(),
  },
  returns: v.object({
    token: v.string(),
    user: publicUserValidator,
  }),
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internalApi.auth.getUserByIdentifier, {
      identifier: args.identifier,
    });

    if (!user || !verifyPassword(args.password, user.passwordSalt, user.passwordHash)) {
      throw new Error("Incorrect email/username or password.");
    }

    const sessionUser = {
      id: user._id,
      username: user.username,
      email: user.email,
    };

    return {
      token: createSessionToken(sessionUser),
      user: sessionUser,
    };
  },
});

export const getCurrentUser = action({
  args: { token: v.string() },
  returns: v.union(publicUserValidator, v.null()),
  handler: async (ctx, { token }) => {
    const sessionUser = verifySessionToken(token);
    if (!sessionUser) {
      return null;
    }

    const user = await ctx.runQuery(internalApi.auth.getUserById, {
      userId: sessionUser.id,
    });

    if (!user) {
      return null;
    }

    return {
      id: user._id,
      username: user.username,
      email: user.email,
    };
  },
});
