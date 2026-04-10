"use node";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type SessionUser = {
  id: string;
  username: string;
  email: string;
};

type SessionPayload = {
  sub: string;
  username: string;
  email: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const JWT_AUDIENCE = "canvas-atlas";

function getJwtSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error("Missing AUTH_JWT_SECRET environment variable.");
  }
  return secret;
}

function getJwtIssuer() {
  return process.env.AUTH_JWT_ISSUER ?? "canvas-atlas";
}

function toBase64Url(input: Buffer | string) {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function signJwtPart(data: string) {
  return toBase64Url(createHmac("sha256", getJwtSecret()).update(data).digest());
}

export function createPasswordRecord(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, passwordSalt: string, passwordHash: string) {
  const candidate = scryptSync(password, passwordSalt, 64);
  const expected = Buffer.from(passwordHash, "hex");

  if (candidate.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(candidate, expected);
}

export function createSessionToken(user: SessionUser) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: user.id,
    username: user.username,
    email: user.email,
    iss: getJwtIssuer(),
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signJwtPart(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionUser | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = signJwtPart(`${encodedHeader}.${encodedPayload}`);

  if (signature.length !== expectedSignature.length) {
    return null;
  }

  if (
    !timingSafeEqual(
      encoder.encode(signature),
      encoder.encode(expectedSignature),
    )
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (payload.iss !== getJwtIssuer() || payload.aud !== JWT_AUDIENCE || payload.exp <= now) {
      return null;
    }

    return {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
