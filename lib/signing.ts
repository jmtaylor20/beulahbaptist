/**
 * Stateless signed values for links we email out.
 *
 * An unsubscribe link has to work without a session and without a database
 * lookup, but must not let anyone unsubscribe an address by editing the URL.
 * Signing the address with the app secret gives both.
 */

import { getAppSecret } from "./config";
import { timingSafeEqual } from "./twilio";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAppSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return base64UrlEncode(new Uint8Array(mac));
}

/**
 * Produce `<payload>.<signature>` where payload is a base64url JSON blob.
 * `purpose` is folded into the signature so an unsubscribe token cannot be
 * replayed against some other endpoint later.
 */
export async function signValue(
  purpose: string,
  data: Record<string, unknown>
): Promise<string> {
  const payload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(data))
  );
  const signature = await sign(`${purpose}.${payload}`);
  return `${payload}.${signature}`;
}

export async function verifyValue<T = Record<string, unknown>>(
  purpose: string,
  token: string
): Promise<T | null> {
  const parts = (token ?? "").split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const expected = await sign(`${purpose}.${payload}`);
  if (!timingSafeEqual(expected, signature)) return null;

  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as T;
  } catch {
    return null;
  }
}

export async function emailUnsubscribeToken(email: string): Promise<string> {
  return signValue("email-unsubscribe", { e: email.trim().toLowerCase() });
}

export async function readEmailUnsubscribeToken(
  token: string
): Promise<string | null> {
  const data = await verifyValue<{ e?: string }>("email-unsubscribe", token);
  return typeof data?.e === "string" ? data.e : null;
}
