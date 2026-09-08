/**
 * Password hashing via Node's built-in `crypto.scrypt` (an OWASP-recommended
 * memory-hard KDF). We use this instead of an external bcrypt-family package
 * so the server has zero native/npm hashing dependency — one less thing to
 * compile or audit — while remaining a real, secure, salted hash.
 *
 * Stored format: "<saltHex>:<hashHex>" — self-describing, no separate
 * column needed for the salt.
 */
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(plain, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  plain: string,
  stored: string
): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const derived = (await scryptAsync(plain, salt, KEY_LENGTH)) as Buffer;
  const storedBuf = Buffer.from(hashHex, "hex");
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}
