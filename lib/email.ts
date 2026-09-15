/**
 * Outbound email through Amazon SES.
 *
 * SES is used rather than a marketing ESP because the church's whole email
 * volume costs about thirty cents a month there, which is the entire reason
 * moving off a per-member subscription saves money.
 *
 * When SES credentials are absent the sender falls back to logging, so local
 * development and preview deploys work without any AWS account.
 */

import { signRequest } from "./aws-sig";
import { getChurchConfig } from "./config";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** RFC 8058 one-click unsubscribe target. */
  listUnsubscribeUrl?: string;
  replyTo?: string;
}

export interface SesConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  fromEmail: string;
  fromName: string;
}

export function getSesConfig(): SesConfig | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? "";
  const region = process.env.AWS_REGION ?? "us-east-1";
  const church = getChurchConfig();

  if (!accessKeyId || !secretAccessKey || !church.fromEmail) return null;

  return {
    accessKeyId,
    secretAccessKey,
    region,
    fromEmail: church.fromEmail,
    fromName: church.fromEmailName,
  };
}

export function isEmailConfigured(): boolean {
  return getSesConfig() !== null;
}

export interface EmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const config = getSesConfig();

  if (!config) {
    // Without this, local sign-in would be impossible: the magic link would be
    // generated and then silently dropped.
    console.warn(
      `[email] SES not configured -- message to ${message.to} not sent.\n` +
        `Subject: ${message.subject}\n${message.text}`
    );
    return { ok: false, error: "Email is not configured." };
  }

  const endpoint = `https://email.${config.region}.amazonaws.com/v2/email/outbound-emails`;

  const headersToSend: Record<string, string> = {};
  if (message.listUnsubscribeUrl) {
    headersToSend["List-Unsubscribe"] = `<${message.listUnsubscribeUrl}>`;
    headersToSend["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const body = JSON.stringify({
    FromEmailAddress: `${config.fromName} <${config.fromEmail}>`,
    Destination: { ToAddresses: [message.to] },
    ...(message.replyTo ? { ReplyToAddresses: [message.replyTo] } : {}),
    Content: {
      Simple: {
        Subject: { Data: message.subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: message.text, Charset: "UTF-8" },
          ...(message.html
            ? { Html: { Data: message.html, Charset: "UTF-8" } }
            : {}),
        },
        ...(Object.keys(headersToSend).length
          ? {
              Headers: Object.entries(headersToSend).map(([Name, Value]) => ({
                Name,
                Value,
              })),
            }
          : {}),
      },
    },
  });

  try {
    const signed = await signRequest({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
      service: "ses",
      method: "POST",
      url: endpoint,
      body,
      headers: { "Content-Type": "application/json" },
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: signed,
      body,
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        ok: false,
        error: `SES returned ${response.status}: ${detail.slice(0, 300)}`,
      };
    }

    const payload = (await response.json()) as { MessageId?: string };
    return { ok: true, messageId: payload.MessageId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Email send failed",
    };
  }
}

/**
 * Send to many recipients with bounded concurrency, isolating failures the
 * same way the SMS batch sender does.
 */
export async function sendEmailBatch(
  messages: EmailMessage[],
  options: {
    concurrency?: number;
    onResult?: (
      message: EmailMessage,
      result: EmailResult
    ) => void | Promise<void>;
  } = {}
): Promise<{ sent: number; failed: number }> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 10, 25));
  let cursor = 0;
  let sent = 0;
  let failed = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= messages.length) return;
      const message = messages[index];
      const result = await sendEmail(message);
      if (result.ok) sent += 1;
      else failed += 1;
      await options.onResult?.(message, result);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, messages.length) }, worker)
  );

  return { sent, failed };
}

/** Basic shape check. Deliverability is proven by the confirmation email. */
export function isValidEmail(value: string): boolean {
  const email = (value ?? "").trim();
  if (email.length < 3 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}
