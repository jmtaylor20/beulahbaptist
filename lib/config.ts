/** Church-level settings that appear in outbound copy and compliance text. */

export interface ChurchConfig {
  name: string;
  /** Short form used inside 160-character texts, where every char is billed. */
  shortName: string;
  helpContact: string;
  fromEmail: string;
  fromEmailName: string;
  mailingAddress: string;
}

export function getChurchConfig(): ChurchConfig {
  return {
    name: process.env.CHURCH_NAME ?? "Beulah Baptist Church",
    shortName: process.env.CHURCH_SHORT_NAME ?? "Beulah Baptist",
    helpContact: process.env.CHURCH_HELP_CONTACT ?? "256-825-6515",
    fromEmail: process.env.EMAIL_FROM ?? "",
    fromEmailName:
      process.env.EMAIL_FROM_NAME ?? process.env.CHURCH_NAME ?? "Beulah Baptist Church",
    mailingAddress:
      process.env.CHURCH_MAILING_ADDRESS ??
      "5891 Lovelady Road, Dadeville, AL 36853",
  };
}

/**
 * Absolute base URL for links we hand to third parties -- magic links, the
 * unsubscribe footer, and the MMS media URL Twilio fetches. Must be the real
 * public origin: Twilio cannot fetch localhost, and a wrong value here means
 * pictures silently fail to attach.
 */
export function getBaseUrl(request?: Request): string {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  if (request) {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }

  return "http://localhost:5173";
}

/** Secret backing every HMAC in the app. Refuses to fall back to a default. */
export function getAppSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "APP_SECRET must be set to a random string of at least 32 characters. " +
        "Generate one with: openssl rand -base64 32"
    );
  }
  return secret;
}
