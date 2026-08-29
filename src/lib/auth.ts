import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "session";
export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function signingKey(): Buffer {
  const password = process.env.SITE_PASSWORD ?? "";
  return createHmac("sha256", "football-session").update(password).digest();
}

export function passwordsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const size = Math.max(a.length, b.length, 1);
  const paddedA = Buffer.alloc(size);
  const paddedB = Buffer.alloc(size);
  a.copy(paddedA);
  b.copy(paddedB);
  return timingSafeEqual(paddedA, paddedB) && a.length === b.length;
}

export function credentialsMatch(password: string): boolean {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) return false;
  return passwordsMatch(password, expected);
}

export function createSessionToken(now = Date.now()): string {
  const expiresAt = String(now + SESSION_MS);
  const signature = createHmac("sha256", signingKey()).update(expiresAt).digest("hex");
  return `${expiresAt}.${signature}`;
}

export function isValidSessionToken(
  token: string | undefined,
  now = Date.now(),
): boolean {
  if (!token || !process.env.SITE_PASSWORD) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature) return false;
  const expected = createHmac("sha256", signingKey()).update(expiresAt).digest("hex");
  if (!passwordsMatch(signature, expected)) return false;
  const exp = Number(expiresAt);
  return Number.isFinite(exp) && exp > now;
}
