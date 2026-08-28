/**
 * Staff authentication by emailed magic link.
 *
 * No passwords: a church office has a handful of users, staff turn over, and
 * shared passwords outlive the people who knew them. Access is an allowlist in
 * the `staff` table -- an email that is not on it never receives a link, and
 * the sign-in form says the same thing either way so the endpoint cannot be
 * used to discover who works there.
 */

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { sessions, signInTokens, staff } from "../db/schema";
import { getBaseUrl, getChurchConfig } from "./config";
import { sendEmail } from "./email";
import {
  expiryFromNow,
  generateToken,
  hashToken,
  isExpired,
} from "./tokens";

export const SESSION_COOKIE = "bbc_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SIGN_IN_TTL_SECONDS = 60 * 15; // 15 minutes

export interface StaffUser {
  id: number;
  email: string;
  name: string;
  role: "admin" | "sender";
}

/**
 * Issue a magic link. Always resolves successfully, whether or not the email
 * belongs to a staff member, so the response cannot enumerate accounts.
 */
export async function requestSignInLink(
  email: string,
  request?: Request
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const db = getDb();
  await bootstrapFirstAdmin(normalized);

  const [account] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.email, normalized), eq(staff.active, true)))
    .limit(1);

  if (!account) return;

  const token = generateToken();
  await db.insert(signInTokens).values({
    staffId: account.id,
    tokenHash: await hashToken(token),
    expiresAt: expiryFromNow(SIGN_IN_TTL_SECONDS),
  });

  const church = getChurchConfig();
  const link = `${getBaseUrl(request)}/admin/signin/verify?token=${token}`;

  await sendEmail({
    to: normalized,
    subject: `Sign in to ${church.shortName} messaging`,
    text:
      `Use this link to sign in to the ${church.name} messaging tool:\n\n` +
      `${link}\n\n` +
      `The link works once and expires in 15 minutes.\n\n` +
      `If you did not request it, you can ignore this email.`,
    html:
      `<p>Use this link to sign in to the ${escapeHtml(church.name)} messaging tool:</p>` +
      `<p><a href="${link}">Sign in</a></p>` +
      `<p>The link works once and expires in 15 minutes.</p>` +
      `<p style="color:#5d6a7b">If you did not request it, you can ignore this email.</p>`,
  });
}

/**
 * Exchange a magic-link token for a session token. Returns null when the token
 * is unknown, already used, or expired.
 */
export async function consumeSignInToken(
  token: string
): Promise<{ sessionToken: string; user: StaffUser } | null> {
  if (!token) return null;

  const db = getDb();
  const tokenHash = await hashToken(token);

  const [row] = await db
    .select()
    .from(signInTokens)
    .where(
      and(eq(signInTokens.tokenHash, tokenHash), isNull(signInTokens.consumedAt))
    )
    .limit(1);

  if (!row || isExpired(row.expiresAt)) return null;

  // Mark consumed before issuing the session, so a link raced in two tabs
  // cannot mint two sessions.
  const consumed = await db
    .update(signInTokens)
    .set({ consumedAt: new Date().toISOString() })
    .where(
      and(eq(signInTokens.id, row.id), isNull(signInTokens.consumedAt))
    )
    .returning({ id: signInTokens.id });

  if (consumed.length === 0) return null;

  const [account] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, row.staffId), eq(staff.active, true)))
    .limit(1);

  if (!account) return null;

  const sessionToken = generateToken();
  await db.insert(sessions).values({
    staffId: account.id,
    tokenHash: await hashToken(sessionToken),
    expiresAt: expiryFromNow(SESSION_TTL_SECONDS),
  });

  await db
    .update(staff)
    .set({ lastSignInAt: new Date().toISOString() })
    .where(eq(staff.id, account.id));

  return {
    sessionToken,
    user: {
      id: account.id,
      email: account.email,
      name: account.name,
      role: account.role,
    },
  };
}

/** Resolve the signed-in staff member from a request's cookie, or null. */
export async function getSessionUser(
  request: Request
): Promise<StaffUser | null> {
  return getStaffBySessionToken(
    readCookie(request.headers.get("cookie"), SESSION_COOKIE)
  );
}

/**
 * Resolve a staff member from a raw session token.
 *
 * Server components read cookies through `next/headers` rather than a
 * Request, so this is the shared core both entry points call.
 */
export async function getStaffBySessionToken(
  token: string | null
): Promise<StaffUser | null> {
  if (!token) return null;

  const db = getDb();
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      active: staff.active,
    })
    .from(sessions)
    .innerJoin(staff, eq(staff.id, sessions.staffId))
    .where(eq(sessions.tokenHash, await hashToken(token)))
    .limit(1);

  if (!row || !row.active || isExpired(row.expiresAt)) return null;

  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export async function destroySession(request: Request): Promise<void> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return;
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, await hashToken(token)));
}

export function sessionCookieHeader(
  token: string,
  { secure = true }: { secure?: boolean } = {}
): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readCookie(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

/**
 * Guard for admin API routes. Returns either the user or a ready-to-return
 * 401, so handlers stay a single early-return line.
 */
export async function requireStaff(
  request: Request
): Promise<{ user: StaffUser; response?: never } | { user?: never; response: Response }> {
  const user = await getSessionUser(request);
  if (!user) {
    return {
      response: Response.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  return { user };
}

/**
 * Create the very first staff account.
 *
 * Access is an allowlist, which leaves a chicken and egg on a fresh deploy:
 * the table is empty, so no one can sign in to add anyone. This resolves it
 * without a console or a CLI -- set ADMIN_BOOTSTRAP_EMAIL, request a link from
 * that address once, and the account is created.
 *
 * Deliberately narrow: it only fires when the table is completely empty, so it
 * cannot be used later to add a second account or re-enable a revoked one.
 */
async function bootstrapFirstAdmin(email: string): Promise<void> {
  const bootstrapEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "")
    .trim()
    .toLowerCase();

  if (!bootstrapEmail || bootstrapEmail !== email) return;

  const db = getDb();
  const existing = await db.select({ id: staff.id }).from(staff).limit(1);
  if (existing.length > 0) return;

  await db.insert(staff).values({
    email,
    name: "",
    role: "admin",
    active: true,
  });

  console.info(`[auth] bootstrapped the first admin account for ${email}`);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
