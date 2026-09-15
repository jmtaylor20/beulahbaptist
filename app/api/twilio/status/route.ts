import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { broadcasts, deliveries } from "../../../../db/schema";
import { markUndeliverable, optOutPhone } from "../../../../lib/members";
import { isCarrierOptOut, isPermanentFailure } from "../../../../lib/twilio";
import { readVerifiedWebhook } from "../../../../lib/webhook";

export const dynamic = "force-dynamic";

/** Twilio's terminal statuses, mapped onto the delivery states we store. */
const STATUS_MAP: Record<string, "sent" | "delivered" | "undelivered" | "failed"> =
  {
    sent: "sent",
    delivered: "delivered",
    undelivered: "undelivered",
    failed: "failed",
  };

/**
 * Delivery receipts.
 *
 * This is where the estimate becomes the actual bill: Twilio reports the real
 * price per message here, which is summed onto the broadcast. It is also how
 * dead numbers get found, so the church stops paying to text them every week.
 */
export async function POST(request: Request) {
  const verified = await readVerifiedWebhook(request);
  if (!verified.ok) return verified.response;

  const sid = verified.params.MessageSid ?? verified.params.SmsSid ?? "";
  const rawStatus = verified.params.MessageStatus ?? "";
  const status = STATUS_MAP[rawStatus];

  // Intermediate states (queued, sending, accepted) carry no new information.
  if (!sid || !status) return new Response("", { status: 204 });

  const errorCode = verified.params.ErrorCode
    ? Number(verified.params.ErrorCode)
    : null;
  const to = verified.params.To ?? "";

  try {
    const db = getDb();

    // Twilio reports price as a negative string like "-0.0083", and only once
    // the message is billed -- it is absent on earlier callbacks.
    const rawPrice = verified.params.Price;
    const priceCents =
      rawPrice === undefined || rawPrice === ""
        ? null
        : Math.round(Math.abs(Number(rawPrice)) * 100);

    const [updated] = await db
      .update(deliveries)
      .set({
        status,
        errorCode: errorCode === null ? null : String(errorCode),
        errorMessage: verified.params.ErrorMessage?.slice(0, 400) ?? null,
        ...(priceCents === null ? {} : { priceCents }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(deliveries.providerId, sid))
      .returning({
        id: deliveries.id,
        broadcastId: deliveries.broadcastId,
      });

    if (updated) {
      await recomputeBroadcastCost(updated.broadcastId);
    }

    // A number that permanently cannot receive texts should stop costing money.
    if (to && (status === "undelivered" || status === "failed")) {
      if (isCarrierOptOut(errorCode)) {
        await optOutPhone({
          phone: to,
          context: {
            source: "carrier",
            evidence: `Twilio error ${errorCode}: recipient opted out at the carrier.`,
          },
        });
      } else if (isPermanentFailure(errorCode)) {
        await markUndeliverable(to);
      }
    }
  } catch (error) {
    // A 500 here makes Twilio retry, which would double-count the price.
    console.error("[twilio/status] could not record receipt", error);
  }

  return new Response("", { status: 204 });
}

/**
 * Recompute a broadcast's actual cost from its delivery rows.
 *
 * Summed rather than incremented so that a retried callback for the same
 * message cannot inflate the total.
 */
async function recomputeBroadcastCost(broadcastId: number): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${deliveries.priceCents}), 0)`,
    })
    .from(deliveries)
    .where(eq(deliveries.broadcastId, broadcastId));

  await db
    .update(broadcasts)
    .set({ actualCostCents: Number(row?.total ?? 0) })
    .where(eq(broadcasts.id, broadcastId));
}
