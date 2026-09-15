/**
 * Phone handling for a US church list. Everything is stored in E.164 so that
 * the same person typed in four different ways is still one member.
 */

const US_COUNTRY_CODE = "1";

export type PhoneParseResult =
  | { ok: true; e164: string }
  | { ok: false; reason: string };

/**
 * Normalise the ways people actually type phone numbers on a signup form:
 * "(256) 825-6515", "256.825.6515", "1-256-825-6515", "+12568256515".
 *
 * Deliberately US-only. A church list that silently accepted a mistyped
 * international number would bill at 10-40x the US rate.
 */
export function parseUsPhone(input: string): PhoneParseResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "Enter a phone number." };

  // Keep a leading + so we can tell "+44..." from a local number.
  const hadPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");

  if (!digits) return { ok: false, reason: "Enter a phone number." };

  let national: string;
  if (digits.length === 10) {
    national = digits;
  } else if (digits.length === 11 && digits.startsWith(US_COUNTRY_CODE)) {
    national = digits.slice(1);
  } else if (hadPlus && !digits.startsWith(US_COUNTRY_CODE)) {
    return {
      ok: false,
      reason: "This list can only text US numbers.",
    };
  } else {
    return {
      ok: false,
      reason: "That doesn't look like a 10-digit US phone number.",
    };
  }

  // NANP rules: area code and exchange code both start 2-9.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) {
    return {
      ok: false,
      reason: "That doesn't look like a valid US phone number.",
    };
  }

  return { ok: true, e164: `+${US_COUNTRY_CODE}${national}` };
}

/** Render +12568256515 as (256) 825-6515 for display in the admin UI. */
export function formatUsPhone(e164: string): string {
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164 ?? "");
  if (!match) return e164 ?? "";
  return `(${match[1]}) ${match[2]}-${match[3]}`;
}

/** Last four digits, for confirming identity without exposing the number. */
export function phoneLastFour(e164: string): string {
  const digits = (e164 ?? "").replace(/\D/g, "");
  return digits.slice(-4);
}
