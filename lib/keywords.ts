/**
 * Compliance keyword handling.
 *
 * The CTIA messaging principles require that STOP, HELP and their common
 * variants always work, in any case, regardless of what else the app does.
 * Twilio's Messaging Service can auto-handle these, but we mirror the logic
 * here so the church's own record of who opted out is authoritative and
 * survives a change of provider.
 */

export type Keyword = "stop" | "start" | "help";

const STOP_WORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "optout",
  "revoke",
]);

const START_WORDS = new Set(["start", "unstop", "yes", "optin", "subscribe"]);

const HELP_WORDS = new Set(["help", "info"]);

/**
 * Match a keyword in an inbound message body.
 *
 * Carriers match on the message being *only* the keyword (allowing for
 * whitespace and trailing punctuation). We match the same way rather than
 * scanning for the word anywhere, so "Please stop by the potluck Sunday" is
 * treated as a reply, not an opt-out.
 */
export function detectKeyword(body: string): Keyword | null {
  const normalized = (body ?? "")
    .trim()
    .toLowerCase()
    // Strip surrounding punctuation and collapse internal spaces so
    // "STOP." and "stop all" both match.
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/\s+/g, "");

  if (!normalized) return null;
  if (STOP_WORDS.has(normalized)) return "stop";
  if (START_WORDS.has(normalized)) return "start";
  if (HELP_WORDS.has(normalized)) return "help";
  return null;
}

export interface KeywordReplies {
  churchName: string;
  helpContact: string;
}

/** The auto-reply carriers expect for each keyword. */
export function keywordReply(
  keyword: Keyword,
  { churchName, helpContact }: KeywordReplies
): string {
  switch (keyword) {
    case "stop":
      return `${churchName}: You have been unsubscribed and will not receive further texts. Reply START to rejoin.`;
    case "start":
      return `${churchName}: You are subscribed again. Msg&data rates may apply. Reply HELP for help, STOP to unsubscribe.`;
    case "help":
      return `${churchName}: Church announcements and prayer requests. Msg&data rates may apply. Reply STOP to unsubscribe. Contact ${helpContact}.`;
  }
}

/**
 * The disclosure that must appear on the first message after signup, and
 * periodically thereafter. Kept here so the wording stays consistent between
 * the signup form, the confirmation text, and the admin UI's preview.
 */
export function complianceFooter(churchName: string): string {
  return `\n\n${churchName}. Reply STOP to opt out.`;
}

/**
 * The exact wording a member agrees to on the public signup form, stored
 * verbatim as consent evidence.
 *
 * Kept here, next to the other compliance copy, so the text recorded in the
 * audit trail cannot drift from the text actually shown on the form.
 */
export function consentWording(churchName: string): string {
  return (
    `Web signup form: "I agree to receive text messages from ${churchName} ` +
    `at the number provided. Message frequency varies. Msg & data rates may ` +
    `apply. Reply STOP to opt out, HELP for help."`
  );
}
