/**
 * Minimal Twilio REST client built on fetch and WebCrypto.
 *
 * The official SDK pulls in Node built-ins that are awkward on Workers, and we
 * only need three endpoints, so this stays dependency-free.
 */

const API_BASE = "https://api.twilio.com/2010-04-01";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** Messaging Service SID -- preferred over a bare number. */
  messagingServiceSid?: string;
  /** Fallback sender if no Messaging Service is configured. */
  fromNumber?: string;
}

export class TwilioNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(
      `Twilio is not configured. Missing environment ${
        missing.length === 1 ? "variable" : "variables"
      }: ${missing.join(", ")}.`
    );
    this.name = "TwilioNotConfiguredError";
  }
}

export function getTwilioConfig(): TwilioConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID ?? "";
  const fromNumber = process.env.TWILIO_FROM_NUMBER ?? "";

  const missing: string[] = [];
  if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!authToken) missing.push("TWILIO_AUTH_TOKEN");
  if (!messagingServiceSid && !fromNumber) {
    missing.push("TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER");
  }
  if (missing.length) throw new TwilioNotConfiguredError(missing);

  return { accountSid, authToken, messagingServiceSid, fromNumber };
}

export function isTwilioConfigured(): boolean {
  try {
    getTwilioConfig();
    return true;
  } catch {
    return false;
  }
}

export interface SendMessageOptions {
  to: string;
  body: string;
  /** Publicly reachable URL. Twilio fetches this itself, so it cannot be private. */
  mediaUrl?: string;
  /** Where Twilio posts delivery receipts. */
  statusCallback?: string;
}

export interface SentMessage {
  sid: string;
  status: string;
  /** Twilio reports price as a negative string, and only once billed. */
  price: number | null;
  numSegments: number;
  errorCode: number | null;
  errorMessage: string | null;
}

export interface SendFailure {
  to: string;
  code: number | null;
  message: string;
}

function basicAuthHeader(config: TwilioConfig): string {
  return `Basic ${btoa(`${config.accountSid}:${config.authToken}`)}`;
}

/**
 * Send one message. Callers should prefer `sendBatch`, which adds the
 * concurrency limiting and per-recipient error isolation a broadcast needs.
 */
export async function sendMessage(
  options: SendMessageOptions,
  config: TwilioConfig = getTwilioConfig()
): Promise<SentMessage> {
  const form = new URLSearchParams();
  form.set("To", options.to);
  form.set("Body", options.body);

  if (config.messagingServiceSid) {
    form.set("MessagingServiceSid", config.messagingServiceSid);
  } else if (config.fromNumber) {
    form.set("From", config.fromNumber);
  }

  if (options.mediaUrl) form.set("MediaUrl", options.mediaUrl);
  if (options.statusCallback) {
    form.set("StatusCallback", options.statusCallback);
  }

  const response = await fetch(
    `${API_BASE}/Accounts/${config.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(config),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    }
  );

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : `Twilio returned ${response.status}`;
    const error = new Error(message) as Error & { code?: number };
    if (typeof payload.code === "number") error.code = payload.code;
    throw error;
  }

  return {
    sid: String(payload.sid ?? ""),
    status: String(payload.status ?? "queued"),
    price:
      payload.price === null || payload.price === undefined
        ? null
        : Math.abs(Number(payload.price)),
    numSegments: Number(payload.num_segments ?? 1) || 1,
    errorCode:
      typeof payload.error_code === "number" ? payload.error_code : null,
    errorMessage:
      typeof payload.error_message === "string" ? payload.error_message : null,
  };
}

/**
 * Send to many recipients with bounded concurrency.
 *
 * Twilio queues messages internally, so the limit here is about not opening
 * 400 simultaneous sockets from a Worker rather than about carrier throughput.
 * One recipient failing (a disconnected number, a landline) must never abort
 * the rest of the broadcast, so failures are collected and returned.
 */
export async function sendBatch(
  recipients: Array<{ to: string; body: string; mediaUrl?: string }>,
  options: {
    statusCallback?: string;
    concurrency?: number;
    config?: TwilioConfig;
    onResult?: (
      recipient: { to: string },
      result: SentMessage | null,
      error: SendFailure | null
    ) => void | Promise<void>;
  } = {}
): Promise<{ sent: number; failed: SendFailure[] }> {
  const config = options.config ?? getTwilioConfig();
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 10, 25));
  const failed: SendFailure[] = [];
  let sent = 0;
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= recipients.length) return;
      const recipient = recipients[index];

      try {
        const result = await sendMessage(
          {
            to: recipient.to,
            body: recipient.body,
            mediaUrl: recipient.mediaUrl,
            statusCallback: options.statusCallback,
          },
          config
        );
        sent += 1;
        await options.onResult?.(recipient, result, null);
      } catch (error) {
        const failure: SendFailure = {
          to: recipient.to,
          code:
            typeof (error as { code?: number }).code === "number"
              ? (error as { code: number }).code
              : null,
          message:
            error instanceof Error ? error.message : "Unknown send error",
        };
        failed.push(failure);
        await options.onResult?.(recipient, null, failure);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, recipients.length) }, worker)
  );

  return { sent, failed };
}

/**
 * Verify Twilio's X-Twilio-Signature header.
 *
 * Without this anyone who guesses the webhook URL could forge an inbound
 * "STOP" for an arbitrary number, or fake delivery receipts. The signature is
 * HMAC-SHA1 over the full URL concatenated with the sorted POST parameters.
 */
export async function verifyTwilioSignature(options: {
  url: string;
  params: Record<string, string>;
  signature: string;
  authToken: string;
}): Promise<boolean> {
  if (!options.signature) return false;

  const sortedKeys = Object.keys(options.params).sort();
  let payload = options.url;
  for (const key of sortedKeys) {
    payload += key + options.params[key];
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(options.authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return timingSafeEqual(expected, options.signature);
}

/** Constant-time string comparison, so signature checks leak no timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Twilio error codes that mean "this number will never work" as opposed to a
 * transient failure. Members hitting these get flagged so the office can
 * clean them up instead of paying to retry every week.
 */
const PERMANENT_ERROR_CODES = new Set([
  21211, // invalid 'To' number
  21214, // 'To' number not mobile / cannot receive
  21610, // recipient has unsubscribed
  21614, // 'To' number is not a valid mobile number
  30003, // unreachable destination handset
  30005, // unknown destination handset
  30006, // landline or unreachable carrier
]);

export function isPermanentFailure(code: number | null): boolean {
  return code !== null && PERMANENT_ERROR_CODES.has(code);
}

/** Twilio error code 21610 means the carrier already has them opted out. */
export function isCarrierOptOut(code: number | null): boolean {
  return code === 21610;
}
