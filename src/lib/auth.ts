import { and, eq, gt } from "drizzle-orm";
import type { AstroCookies } from "astro";
import { db } from "./db";
import { adminUsers, sessions } from "./db/schema";
import { sha256 } from "./ids";

const COOKIE = "tr_session";
// Cloudflare Workers rejects PBKDF2 above 100k iterations, so this is both the
// storage cost and the platform ceiling. Do not raise it.
const ITERATIONS = 100_000;

function b64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let out = "";
  for (const byte of arr) out += String.fromCharCode(byte);
  return btoa(out);
}

export async function hashPassword(
  password: string,
  salt: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return b64(bits);
}

export function newSalt(): string {
  return b64(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

export async function verifyPassword(
  password: string,
  salt: string,
  expected: string,
): Promise<boolean> {
  const actual = await hashPassword(password, salt);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSession(
  userId: string,
  cookies: AstroCookies,
): Promise<void> {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const id = await sha256(token);
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  await db.insert(sessions).values({ id, userId, expiresAt });
  cookies.set(COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function destroySession(cookies: AstroCookies): Promise<void> {
  const token = cookies.get(COOKIE)?.value;
  if (token) {
    const id = await sha256(token);
    await db.delete(sessions).where(eq(sessions.id, id));
  }
  cookies.delete(COOKIE, { path: "/" });
}

export async function getSessionUser(cookies: AstroCookies) {
  const token = cookies.get(COOKIE)?.value;
  if (!token) return null;
  const id = await sha256(token);
  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
    })
    .from(sessions)
    .innerJoin(adminUsers, eq(adminUsers.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, Date.now())))
    .limit(1);
  return rows[0] ?? null;
}
