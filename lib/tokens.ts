/**
 * Token generation and hashing.
 *
 * Anything we hand to a browser or a phone (magic links, session cookies,
 * verification codes) is stored only as a SHA-256 hash, so a copy of the
 * database is not a set of working credentials.
 */

const HEX = "0123456789abcdef";

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += HEX[byte >> 4] + HEX[byte & 15];
  }
  return out;
}

/** URL-safe random token. 32 bytes gives 256 bits of entropy. */
export function generateToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return toHex(buffer);
}

/**
 * Six-digit verification code.
 *
 * Uses rejection sampling rather than `% 1000000`, which would bias the low
 * codes. Overkill for a church text list, but it costs nothing.
 */
export function generateNumericCode(digits = 6): string {
  const max = 10 ** digits;
  const limit = Math.floor(0xffffffff / max) * max;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return String(value % max).padStart(digits, "0");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return toHex(new Uint8Array(digest));
}

/**
 * Hash a verification code together with the phone it was issued for, so a
 * code leaked for one number cannot be replayed against another.
 */
export async function hashCode(code: string, phone: string): Promise<string> {
  return hashToken(`${phone}:${code}`);
}

/** ISO timestamp `seconds` from now, matching the schema's text columns. */
export function expiryFromNow(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function isExpired(isoTimestamp: string): boolean {
  const time = Date.parse(isoTimestamp);
  return !Number.isFinite(time) || time <= Date.now();
}
