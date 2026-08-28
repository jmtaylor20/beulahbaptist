import { requireStaff } from "../../../../lib/auth";
import {
  previewBroadcast,
  sendBroadcast,
  type ComposeInput,
} from "../../../../lib/broadcast";
import { isEmailConfigured } from "../../../../lib/email";
import { isTwilioConfigured } from "../../../../lib/twilio";

export const dynamic = "force-dynamic";

/**
 * Price a broadcast without sending it.
 *
 * The composer calls this as the message is typed, so the sender sees the cost
 * and the segment count change in real time rather than finding out on the
 * invoice.
 */
export async function POST(request: Request) {
  const auth = await requireStaff(request);
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as {
      action?: "preview" | "send";
      confirmTotal?: number;
    } & Partial<ComposeInput>;

    const input = parseInput(payload);
    if ("error" in input) {
      return Response.json({ error: input.error }, { status: 400 });
    }

    if (payload.action === "send") {
      const missing = missingProviderConfig(input.channel);
      if (missing) return Response.json({ error: missing }, { status: 503 });

      // Re-price server-side and compare against what the sender saw. If the
      // audience grew between preview and send, the click is not consent to
      // spend the larger amount.
      const preview = await previewBroadcast(input);
      if (
        typeof payload.confirmTotal === "number" &&
        preview.total > payload.confirmTotal * 1.05 + 0.01
      ) {
        return Response.json(
          {
            error:
              "The audience changed since you last previewed this message. " +
              "Review the new cost and send again.",
            preview,
          },
          { status: 409 }
        );
      }

      const result = await sendBroadcast({
        input,
        staffId: auth.user.id,
        request,
      });

      return Response.json({ ok: true, ...result });
    }

    return Response.json({ ok: true, preview: await previewBroadcast(input) });
  } catch (error) {
    console.error("[admin/broadcasts] failed", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong composing that message.",
      },
      { status: 500 }
    );
  }
}

function parseInput(
  payload: Partial<ComposeInput>
): ComposeInput | { error: string } {
  const channel = payload.channel === "email" ? "email" : "sms";
  const body = (payload.body ?? "").trim();

  if (!body) return { error: "The message body is empty." };

  if (channel === "email" && !(payload.subject ?? "").trim()) {
    return { error: "Email needs a subject line." };
  }

  const groupIds = (payload.groupIds ?? [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (groupIds.length === 0) {
    return { error: "Choose at least one group to send to." };
  }

  // MMS carries up to 1600 characters; plain SMS has no hard cap but a very
  // long one is almost always a mistake that costs real money.
  const limit = channel === "email" ? 100_000 : 1600;
  if (body.length > limit) {
    return {
      error: `That message is ${body.length} characters, over the ${limit} limit.`,
    };
  }

  return {
    channel,
    body,
    subject: payload.subject ?? "",
    mediaId: channel === "sms" ? payload.mediaId ?? null : null,
    groupIds,
    includeFooter: payload.includeFooter !== false,
  };
}

function missingProviderConfig(channel: "sms" | "email"): string | null {
  if (channel === "sms" && !isTwilioConfigured()) {
    return "Twilio is not configured yet, so texts cannot be sent. Add the Twilio environment variables first.";
  }
  if (channel === "email" && !isEmailConfigured()) {
    return "Email is not configured yet. Add the AWS SES environment variables first.";
  }
  return null;
}
