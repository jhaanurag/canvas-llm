"use node";

import type { FunctionReference } from "convex/server";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  createPasswordRecord,
  createSessionToken,
  verifyPassword,
  verifySessionToken,
} from "./authShared";
import { isValidEmail, isValidUsername } from "./authUtils";

const publicUserValidator = v.object({
  id: v.string(),
  username: v.string(),
  email: v.string(),
});
const internalApi = internal as unknown as {
  authModel: {
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
    const user = await ctx.runMutation(internalApi.authModel.createUser, {
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
    const user = await ctx.runQuery(internalApi.authModel.getUserByIdentifier, {
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

    const user = await ctx.runQuery(internalApi.authModel.getUserById, {
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
