/**
 * Shared verification for Twilio's webhooks.
 *
 * These endpoints are public URLs. Without a signature check, anyone who
 * guessed one could forge a STOP for an arbitrary number, or post fake
 * delivery receipts that corrupt the church's cost reporting.
 */

import { getBaseUrl } from "./config";
import { getTwilioConfig, verifyTwilioSignature } from "./twilio";

export interface VerifiedWebhook {
  ok: true;
  params: Record<string, string>;
}

export interface RejectedWebhook {
  ok: false;
  response: Response;
}

export async function readVerifiedWebhook(
  request: Request
): Promise<VerifiedWebhook | RejectedWebhook> {
  let authToken: string;
  try {
    authToken = getTwilioConfig().authToken;
  } catch {
    console.error("[webhook] Twilio is not configured; rejecting.");
    return {
      ok: false,
      response: new Response("Not configured", { status: 503 }),
    };
  }

  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  /*
   * Twilio signs the URL it was configured with. Behind a proxy the inbound
   * request URL can differ (http vs https, internal host), so the canonical
   * public origin is used when one is configured.
   */
  const requestUrl = new URL(request.url);
  const signedUrl = `${getBaseUrl(request)}${requestUrl.pathname}${requestUrl.search}`;

  const valid = await verifyTwilioSignature({
    url: signedUrl,
    params,
    signature: request.headers.get("x-twilio-signature") ?? "",
    authToken,
  });

  if (!valid) {
    console.warn(`[webhook] rejected an unsigned request to ${signedUrl}`);
    return {
      ok: false,
      response: new Response("Invalid signature", { status: 403 }),
    };
  }

  return { ok: true, params };
}

/** TwiML response. An empty <Response/> tells Twilio to send nothing back. */
export function twiml(message?: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
        message
      )}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

  return new Response(body, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
