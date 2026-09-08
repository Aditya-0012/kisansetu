/**
 * Minimal HS256 JWT sign/verify using only Node's built-in `crypto` module.
 *
 * We deliberately don't depend on the `jsonwebtoken` package: the format is
 * a handful of lines of base64url + HMAC, and implementing it directly means
 * one fewer supply-chain dependency for something security-sensitive. This
 * follows the JWT spec (RFC 7519) exactly — header.payload.signature, all
 * base64url-encoded, HMAC-SHA256 over "header.payload" — so it interops with
 * any standard JWT tooling if you ever need to inspect a token externally
 * (e.g. paste one into jwt.io).
 */
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "../config/env";

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (padded.length % 4)) % 4);
  return Buffer.from(padded + padding, "base64");
}

function parseExpiry(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return 7 * 24 * 3600; // default 7 days
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}

export interface JwtPayload {
  sub: string; // user id
  role: string;
  [key: string]: unknown;
}

export function signToken(payload: JwtPayload): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + parseExpiry(env.JWT_EXPIRES_IN),
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  const signature = createHmac("sha256", env.JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  return `${encodedHeader}.${encodedPayload}.${base64url(signature)}`;
}

export class JwtError extends Error {}

export function verifyToken(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new JwtError("Malformed token");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  const expectedSignature = createHmac("sha256", env.JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const actualSignature = base64urlDecode(encodedSignature);

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new JwtError("Invalid signature");
  }

  const payload = JSON.parse(base64urlDecode(encodedPayload).toString("utf-8"));
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) {
    throw new JwtError("Token expired");
  }
  return payload as JwtPayload;
}
