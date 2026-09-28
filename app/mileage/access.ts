import { cookies } from "next/headers";

// The mileage log is locked behind a PIN set in the MILEAGE_PIN environment
// variable (Netlify: Site configuration > Environment variables). The cookie
// holds a hash of the PIN, so changing the PIN signs out every device. If the
// variable is missing, nobody gets in.

export const ACCESS_COOKIE = "bbc_mileage";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 365;

export async function accessToken(pin: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`beulah-mileage:${pin}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function configuredPin() {
  return process.env.MILEAGE_PIN?.trim() || null;
}

export async function hasAccess() {
  const pin = configuredPin();
  if (!pin) return false;
  const cookie = (await cookies()).get(ACCESS_COOKIE)?.value;
  return !!cookie && cookie === (await accessToken(pin));
}
