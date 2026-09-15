/**
 * Composing and sending a broadcast.
 *
 * Sending is the one irreversible action in this app -- there is no unsend, and
 * every recipient costs money. So the flow is: resolve the audience, price it,
 * write a `broadcasts` row plus one `deliveries` row per recipient, and only
 * then hand messages to the provider. If the Worker dies halfway through, the
 * deliveries table still shows exactly who was and was not reached.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { broadcasts, deliveries, mediaAssets } from "../db/schema";
import { getBaseUrl, getChurchConfig } from "./config";
import { sendEmailBatch } from "./email";
import { complianceFooter } from "./keywords";
import { markUndeliverable, resolveAudience, type Recipient } from "./members";
import { estimateCost, type BroadcastKind } from "./pricing";
import { analyzeMessage } from "./segments";
import { emailUnsubscribeToken } from "./signing";
import {
  getTwilioConfig,
  isCarrierOptOut,
  isPermanentFailure,
  sendBatch,
} from "./twilio";

export interface ComposeInput {
  channel: "sms" | "email";
  body: string;
  subject?: string;
  mediaId?: string | null;
  groupIds: number[];
  /** Append "Reply STOP to opt out" to SMS. Required periodically by carriers. */
  includeFooter?: boolean;
}

export interface Preview {
  kind: BroadcastKind;
  recipients: number;
  segmentsPerRecipient: number;
  encoding: "GSM-7" | "UCS-2";
  characters: number;
  offendingCharacters: string[];
  perRecipient: number;
  total: number;
  /** Full message as it will be sent, footer included. */
  renderedBody: string;
}

export function broadcastKind(input: ComposeInput): BroadcastKind {
  if (input.channel === "email") return "email";
  return input.mediaId ? "mms" : "sms";
}

/**
 * Build the exact text that goes out, so the cost preview and the phone
 * preview are computed from the same string that is actually sent.
 */
export function renderBody(input: ComposeInput): string {
  const body = input.body ?? "";
  if (input.channel !== "sms" || !input.includeFooter) return body;
  return body + complianceFooter(getChurchConfig().shortName);
}

export async function previewBroadcast(
  input: ComposeInput
): Promise<Preview> {
  const audience = await resolveAudience({
    groupIds: input.groupIds,
    channel: input.channel,
  });

  const kind = broadcastKind(input);
  const renderedBody = renderBody(input);
  const analysis = analyzeMessage(renderedBody);

  // MMS and email are billed per message; only plain SMS is billed per segment.
  const segmentsPerRecipient = kind === "sms" ? analysis.segments : 1;

  const cost = estimateCost({
    kind,
    recipients: audience.length,
    segmentsPerRecipient,
  });

  return {
    kind,
    recipients: audience.length,
    segmentsPerRecipient,
    encoding: analysis.encoding,
    characters: analysis.characters,
    offendingCharacters: analysis.offendingCharacters,
    perRecipient: cost.perRecipient,
    total: cost.total,
    renderedBody,
  };
}

export interface SendResult {
  broadcastId: number;
  attempted: number;
  sent: number;
  failed: number;
}

/**
 * Send a broadcast. Returns once every message has been handed to the
 * provider; final delivery state arrives later on the status webhook.
 */
export async function sendBroadcast(options: {
  input: ComposeInput;
  staffId: number;
  request: Request;
}): Promise<SendResult> {
  const { input, staffId, request } = options;
  const db = getDb();

  const audience = await resolveAudience({
    groupIds: input.groupIds,
    channel: input.channel,
  });

  if (audience.length === 0) {
    throw new Error(
      "No confirmed subscribers are in the selected groups, so there is nobody to send to."
    );
  }

  const kind = broadcastKind(input);
  const renderedBody = renderBody(input);
  const analysis = analyzeMessage(renderedBody);
  const segmentsPerRecipient = kind === "sms" ? analysis.segments : 1;
  const estimate = estimateCost({
    kind,
    recipients: audience.length,
    segmentsPerRecipient,
  });

  const [broadcast] = await db
    .insert(broadcasts)
    .values({
      channel: input.channel,
      subject: input.subject ?? "",
      body: renderedBody,
      mediaId: input.mediaId ?? null,
      status: "sending",
      groupIds: JSON.stringify(input.groupIds),
      recipientCount: audience.length,
      segmentsPerRecipient,
      estimatedCostCents: estimate.totalCents,
      createdBy: staffId,
      sentAt: new Date().toISOString(),
    })
    .returning();

  // One delivery row per recipient, written before anything is sent, so a
  // crash mid-send leaves an accurate record of who was queued.
  const deliveryIds = await insertDeliveries(
    broadcast.id,
    audience,
    segmentsPerRecipient
  );

  try {
    const result =
      input.channel === "sms"
        ? await sendSms({
            audience,
            deliveryIds,
            body: renderedBody,
            mediaId: input.mediaId ?? null,
            request,
          })
        : await sendEmails({
            audience,
            deliveryIds,
            subject: input.subject ?? "",
            body: renderedBody,
            request,
          });

    await db
      .update(broadcasts)
      .set({ status: result.failed === result.attempted ? "failed" : "sent" })
      .where(eq(broadcasts.id, broadcast.id));

    return { broadcastId: broadcast.id, ...result };
  } catch (error) {
    await db
      .update(broadcasts)
      .set({ status: "failed" })
      .where(eq(broadcasts.id, broadcast.id));
    throw error;
  }
}

/**
 * Write the delivery rows and return destination -> row id, so each send
 * result updates exactly one row by primary key.
 *
 * D1 caps how many parameters a single statement may bind, so this inserts in
 * chunks rather than one 400-row statement.
 */
async function insertDeliveries(
  broadcastId: number,
  audience: Recipient[],
  segments: number
): Promise<Map<string, number>> {
  const db = getDb();
  const CHUNK = 50;
  const ids = new Map<string, number>();

  for (let index = 0; index < audience.length; index += CHUNK) {
    const chunk = audience.slice(index, index + CHUNK);
    const inserted = await db
      .insert(deliveries)
      .values(
        chunk.map((recipient) => ({
          broadcastId,
          memberId: recipient.memberId,
          destination: recipient.destination,
          status: "queued" as const,
          segments,
        }))
      )
      .returning({
        id: deliveries.id,
        destination: deliveries.destination,
      });

    for (const row of inserted) ids.set(row.destination, row.id);
  }

  return ids;
}

async function sendSms(options: {
  audience: Recipient[];
  deliveryIds: Map<string, number>;
  body: string;
  mediaId: string | null;
  request: Request;
}): Promise<{ attempted: number; sent: number; failed: number }> {
  const db = getDb();
  const config = getTwilioConfig();
  const baseUrl = getBaseUrl(options.request);

  let mediaUrl: string | undefined;
  if (options.mediaId) {
    const [asset] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, options.mediaId))
      .limit(1);
    if (!asset) throw new Error("The attached image could not be found.");
    mediaUrl = `${baseUrl}/media/${asset.id}`;
  }

  const statusCallback = `${baseUrl}/api/twilio/status`;

  const result = await sendBatch(
    options.audience.map((recipient) => ({
      to: recipient.destination,
      body: options.body,
      mediaUrl,
    })),
    {
      statusCallback,
      config,
      onResult: async (recipient, sent, failure) => {
        const deliveryId = options.deliveryIds.get(recipient.to);

        if (sent) {
          if (deliveryId !== undefined) {
            await db
              .update(deliveries)
              .set({
                providerId: sent.sid,
                status: "sent",
                segments: sent.numSegments,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(deliveries.id, deliveryId));
          }
          return;
        }

        if (failure) {
          if (deliveryId !== undefined) {
            await db
              .update(deliveries)
              .set({
                status: "failed",
                errorCode: failure.code === null ? null : String(failure.code),
                errorMessage: failure.message.slice(0, 400),
                updatedAt: new Date().toISOString(),
              })
              .where(eq(deliveries.id, deliveryId));
          }

          // A number that can never receive a text should stop being paid for
          // every week. Carrier-level opt-outs are recorded as opt-outs so we
          // honour them even though the STOP never reached our webhook.
          if (isCarrierOptOut(failure.code)) {
            const { optOutPhone } = await import("./members");
            await optOutPhone({
              phone: recipient.to,
              context: {
                source: "carrier",
                evidence: `Twilio error ${failure.code}: recipient has opted out at the carrier.`,
              },
            });
          } else if (isPermanentFailure(failure.code)) {
            await markUndeliverable(recipient.to);
          }
        }
      },
    }
  );

  return {
    attempted: options.audience.length,
    sent: result.sent,
    failed: result.failed.length,
  };
}

async function sendEmails(options: {
  audience: Recipient[];
  deliveryIds: Map<string, number>;
  subject: string;
  body: string;
  request: Request;
}): Promise<{ attempted: number; sent: number; failed: number }> {
  const db = getDb();
  const church = getChurchConfig();
  const baseUrl = getBaseUrl(options.request);

  const messages = await Promise.all(
    options.audience.map(async (recipient) => {
      const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${await emailUnsubscribeToken(
        recipient.destination
      )}`;
      return {
        to: recipient.destination,
        subject: options.subject,
        text: `${options.body}\n\n---\n${church.name}\n${church.mailingAddress}\nUnsubscribe: ${unsubscribeUrl}`,
        html: emailHtml({
          body: options.body,
          churchName: church.name,
          mailingAddress: church.mailingAddress,
          unsubscribeUrl,
        }),
        listUnsubscribeUrl: unsubscribeUrl,
      };
    })
  );

  const result = await sendEmailBatch(messages, {
    onResult: async (message, outcome) => {
      const deliveryId = options.deliveryIds.get(message.to);
      if (deliveryId === undefined) return;

      await db
        .update(deliveries)
        .set({
          providerId: outcome.messageId ?? null,
          status: outcome.ok ? "sent" : "failed",
          errorMessage: outcome.error?.slice(0, 400) ?? null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(deliveries.id, deliveryId));
    },
  });

  return {
    attempted: options.audience.length,
    sent: result.sent,
    failed: result.failed,
  };
}

/**
 * Plain, single-column HTML. Church newsletters get read on phones in a pew,
 * and heavy templates are what trip spam filters for a new sending domain.
 */
function emailHtml(options: {
  body: string;
  churchName: string;
  mailingAddress: string;
  unsubscribeUrl: string;
}): string {
  const paragraphs = options.body
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(block).replace(
          /\n/g,
          "<br>"
        )}</p>`
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;padding:0;background:#f7f2e8">
<div style="max-width:600px;margin:0 auto;padding:28px 22px;background:#fffdf9;font-family:Georgia,'Times New Roman',serif;color:#16263b;font-size:16px">
${paragraphs}
<hr style="margin:28px 0 16px;border:0;border-top:1px solid #d9d4ca">
<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#5d6a7b;line-height:1.5">
${escapeHtml(options.churchName)}<br>${escapeHtml(options.mailingAddress)}<br>
<a href="${options.unsubscribeUrl}" style="color:#5d6a7b">Unsubscribe from these emails</a>
</p></div></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Roll delivery rows up into the counts the history page shows. */
export async function broadcastStats(broadcastId: number) {
  const db = getDb();
  const rows = await db
    .select({
      status: deliveries.status,
      count: sql<number>`count(*)`,
      cost: sql<number>`coalesce(sum(${deliveries.priceCents}), 0)`,
    })
    .from(deliveries)
    .where(eq(deliveries.broadcastId, broadcastId))
    .groupBy(deliveries.status);

  const byStatus: Record<string, number> = {};
  let actualCostCents = 0;
  for (const row of rows) {
    byStatus[row.status] = Number(row.count);
    actualCostCents += Number(row.cost);
  }

  return { byStatus, actualCostCents };
}

export async function deleteBroadcastDrafts(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDb();
  await db
    .delete(broadcasts)
    .where(and(inArray(broadcasts.id, ids), eq(broadcasts.status, "draft")));
}
