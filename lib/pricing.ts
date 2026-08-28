/**
 * Cost estimation for a broadcast.
 *
 * Rates are Twilio's published US list prices plus the carrier pass-through
 * fees they bill on top. Carrier fees differ per network (AT&T, T-Mobile,
 * Verizon, US Cellular) and we do not know a member's carrier until after the
 * message is sent, so the estimate uses a blend. Actual per-message price
 * comes back on the status callback and is what gets stored against the
 * broadcast -- the estimate is only ever a pre-send warning.
 *
 * Every rate is overridable through env so a rate change does not need a
 * code deploy.
 */

export interface Rates {
  /** Twilio's charge per outbound SMS segment. */
  smsPerSegment: number;
  /** Blended carrier pass-through per outbound SMS segment. */
  smsCarrierPerSegment: number;
  /** Twilio's charge per outbound MMS (per message, not per segment). */
  mmsPerMessage: number;
  /** Blended carrier pass-through per outbound MMS. */
  mmsCarrierPerMessage: number;
  /** Cost per outbound email (Amazon SES list price). */
  emailPerMessage: number;
  /**
   * Twilio.org nonprofit discount applied to Twilio's own charges. Carrier
   * fees are pass-through and are never discounted.
   */
  twilioDiscount: number;
}

export const DEFAULT_RATES: Rates = {
  smsPerSegment: 0.0083,
  smsCarrierPerSegment: 0.0042,
  mmsPerMessage: 0.022,
  mmsCarrierPerMessage: 0.009,
  emailPerMessage: 0.0001,
  twilioDiscount: 0,
};

function readRate(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function getRates(): Rates {
  const discount = readRate(
    "TWILIO_NONPROFIT_DISCOUNT",
    DEFAULT_RATES.twilioDiscount
  );
  return {
    smsPerSegment: readRate("RATE_SMS_SEGMENT", DEFAULT_RATES.smsPerSegment),
    smsCarrierPerSegment: readRate(
      "RATE_SMS_CARRIER_SEGMENT",
      DEFAULT_RATES.smsCarrierPerSegment
    ),
    mmsPerMessage: readRate("RATE_MMS_MESSAGE", DEFAULT_RATES.mmsPerMessage),
    mmsCarrierPerMessage: readRate(
      "RATE_MMS_CARRIER_MESSAGE",
      DEFAULT_RATES.mmsCarrierPerMessage
    ),
    emailPerMessage: readRate("RATE_EMAIL", DEFAULT_RATES.emailPerMessage),
    // Guard against a typo like "25" meaning 25% turning into a 2500% discount.
    twilioDiscount: discount > 0 && discount < 1 ? discount : 0,
  };
}

export type BroadcastKind = "sms" | "mms" | "email";

export interface CostEstimate {
  kind: BroadcastKind;
  recipients: number;
  /** Billable segments per recipient. Always 1 for MMS and email. */
  segmentsPerRecipient: number;
  /** Cost to reach one person, in dollars. */
  perRecipient: number;
  /** Total cost in dollars. */
  total: number;
  /** Total rounded to whole cents, for storage. */
  totalCents: number;
}

export function estimateCost(options: {
  kind: BroadcastKind;
  recipients: number;
  segmentsPerRecipient?: number;
  rates?: Rates;
}): CostEstimate {
  const rates = options.rates ?? getRates();
  const recipients = Math.max(0, Math.floor(options.recipients));

  /*
   * Clamp here rather than trusting the caller. getRates() sanitises what
   * comes from env, but `rates` can also be passed in directly, and a value
   * like 25 (meaning "25 percent") would otherwise produce a negative price
   * and a send that looks free.
   */
  const discount =
    rates.twilioDiscount > 0 && rates.twilioDiscount < 1
      ? rates.twilioDiscount
      : 0;
  const keep = 1 - discount;

  let perRecipient: number;
  let segmentsPerRecipient: number;

  if (options.kind === "mms") {
    // MMS is billed per message and carries up to 1600 characters of text,
    // so segment count is irrelevant to what it costs.
    segmentsPerRecipient = 1;
    perRecipient =
      rates.mmsPerMessage * keep + rates.mmsCarrierPerMessage;
  } else if (options.kind === "email") {
    segmentsPerRecipient = 1;
    perRecipient = rates.emailPerMessage;
  } else {
    segmentsPerRecipient = Math.max(1, options.segmentsPerRecipient ?? 1);
    perRecipient =
      (rates.smsPerSegment * keep + rates.smsCarrierPerSegment) *
      segmentsPerRecipient;
  }

  const total = perRecipient * recipients;

  return {
    kind: options.kind,
    recipients,
    segmentsPerRecipient,
    perRecipient,
    total,
    totalCents: Math.round(total * 100),
  };
}

/** "$8.93" -- or "$0.0255" when a sub-cent figure would otherwise read "$0.00". */
export function formatCost(dollars: number): string {
  if (dollars > 0 && dollars < 0.01) return `$${dollars.toFixed(4)}`;
  return `$${dollars.toFixed(2)}`;
}

/**
 * What the same message would cost as an SMS-with-link instead of an MMS.
 * Surfaced in the composer so the sender can see the cheaper option rather
 * than discovering it on the invoice.
 */
export function compareMmsToLink(options: {
  recipients: number;
  linkMessageSegments: number;
  rates?: Rates;
}): { mms: number; link: number; savings: number } {
  const rates = options.rates ?? getRates();
  const mms = estimateCost({
    kind: "mms",
    recipients: options.recipients,
    rates,
  }).total;
  const link = estimateCost({
    kind: "sms",
    recipients: options.recipients,
    segmentsPerRecipient: options.linkMessageSegments,
    rates,
  }).total;
  return { mms, link, savings: mms - link };
}
