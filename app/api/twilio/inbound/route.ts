import { getDb } from "../../../../db";
import { inboundMessages } from "../../../../db/schema";
import { getChurchConfig } from "../../../../lib/config";
import { detectKeyword, keywordReply } from "../../../../lib/keywords";
import {
  findMemberByPhone,
  optInPhoneAgain,
  optOutPhone,
} from "../../../../lib/members";
import { readVerifiedWebhook, twiml } from "../../../../lib/webhook";

export const dynamic = "force-dynamic";

/**
 * Inbound texts from members.
 *
 * Two jobs: honour STOP/START/HELP immediately, and keep every other reply so
 * the office can read what people actually send back. Replies are one of the
 * things a broadcast-only tool throws away, and they are usually the most
 * pastorally useful part.
 */
export async function POST(request: Request) {
  const verified = await readVerifiedWebhook(request);
  if (!verified.ok) return verified.response;

  const from = verified.params.From ?? "";
  const body = verified.params.Body ?? "";
  const messageSid = verified.params.MessageSid ?? null;

  if (!from) return twiml();

  const church = getChurchConfig();
  const keyword = detectKeyword(body);

  try {
    const member = await findMemberByPhone(from);
    const db = getDb();

    await db.insert(inboundMessages).values({
      memberId: member?.id ?? null,
      fromPhone: from,
      body: body.slice(0, 2000),
      providerId: messageSid,
      keyword,
      handledAt: keyword ? new Date().toISOString() : null,
    });

    if (keyword === "stop") {
      await optOutPhone({
        phone: from,
        context: {
          source: "sms_keyword",
          evidence: `Replied "${body.trim().slice(0, 100)}" to a church text.`,
        },
      });
    } else if (keyword === "start") {
      await optInPhoneAgain({
        phone: from,
        context: {
          source: "sms_keyword",
          evidence: `Replied "${body.trim().slice(0, 100)}" to rejoin.`,
        },
      });
    }
  } catch (error) {
    // Never fail the webhook on a database problem: Twilio would retry, and a
    // dropped STOP is a compliance failure. The auto-reply below still goes
    // out, and Twilio's own Advanced Opt-Out has already blocked the number.
    console.error("[twilio/inbound] could not record message", error);
  }

  /*
   * Twilio's Messaging Service sends its own STOP/HELP responses when Advanced
   * Opt-Out is enabled. Replying here as well would double-text the member, so
   * the auto-reply is opt-in through an env flag for churches that use a bare
   * number instead of a Messaging Service.
   */
  if (keyword && process.env.TWILIO_SEND_KEYWORD_REPLIES === "true") {
    return twiml(
      keywordReply(keyword, {
        churchName: church.shortName,
        helpContact: church.helpContact,
      })
    );
  }

  return twiml();
}
