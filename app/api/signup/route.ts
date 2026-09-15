import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { groups, verificationCodes } from "../../../db/schema";
import { getChurchConfig } from "../../../lib/config";
import { consentWording } from "../../../lib/keywords";
import {
  addMemberToGroups,
  beginPhoneSignup,
} from "../../../lib/members";
import { parseUsPhone } from "../../../lib/phone";
import {
  expiryFromNow,
  generateNumericCode,
  hashCode,
} from "../../../lib/tokens";
import { getTwilioConfig, sendMessage } from "../../../lib/twilio";

export const dynamic = "force-dynamic";

const CODE_TTL_SECONDS = 10 * 60;
const MAX_CODES_PER_HOUR = 5;

/**
 * Step one of double opt-in: record the request and text a verification code.
 *
 * We never add anyone to the send list here. Until the code comes back we have
 * no proof the person entering the number owns the phone, and texting someone
 * who did not ask is exactly the thing that draws TCPA complaints.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      groupIds?: number[];
      consent?: boolean;
    };

    if (!payload.consent) {
      return Response.json(
        { error: "Please check the box agreeing to receive text messages." },
        { status: 400 }
      );
    }

    const firstName = (payload.firstName ?? "").trim().slice(0, 80);
    const lastName = (payload.lastName ?? "").trim().slice(0, 80);
    if (!firstName) {
      return Response.json(
        { error: "Please enter your first name." },
        { status: 400 }
      );
    }

    const parsed = parseUsPhone(payload.phone ?? "");
    if (!parsed.ok) {
      return Response.json({ error: parsed.reason }, { status: 400 });
    }

    if (await tooManyCodes(parsed.e164)) {
      return Response.json(
        {
          error:
            "Too many verification codes requested for that number. Please try again later.",
        },
        { status: 429 }
      );
    }

    const church = getChurchConfig();

    // Fail before writing anything if we cannot actually send the code --
    // otherwise the member is left stranded in "pending" forever.
    let twilio;
    try {
      twilio = getTwilioConfig();
    } catch {
      return Response.json(
        {
          error:
            "Text signup is not available right now. Please contact the church office.",
        },
        { status: 503 }
      );
    }

    const member = await beginPhoneSignup({
      phone: parsed.e164,
      firstName,
      lastName,
      email: payload.email ?? null,
      context: {
        source: "web_form",
        evidence: consentWording(church.name),
        ipAddress: clientIp(request),
        userAgent: request.headers.get("user-agent"),
      },
    });

    const requestedGroups = await validateSelfServeGroups(
      payload.groupIds ?? []
    );
    if (requestedGroups.length) {
      await addMemberToGroups(member.id, requestedGroups);
    }

    const code = generateNumericCode();
    const db = getDb();
    await db.insert(verificationCodes).values({
      phone: parsed.e164,
      codeHash: await hashCode(code, parsed.e164),
      expiresAt: expiryFromNow(CODE_TTL_SECONDS),
    });

    await sendMessage(
      {
        to: parsed.e164,
        body:
          `${church.shortName}: Your verification code is ${code}. ` +
          `Reply STOP to opt out. Msg&data rates may apply.`,
      },
      twilio
    );

    return Response.json({ ok: true, memberId: member.id });
  } catch (error) {
    console.error("[signup] failed", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

/** Only groups explicitly marked self-serve may be chosen from a public form. */
async function validateSelfServeGroups(
  requested: number[]
): Promise<number[]> {
  const wanted = requested
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (wanted.length === 0) return [];

  const db = getDb();
  const allowed = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.selfServe, true));

  const allowedIds = new Set(allowed.map((row) => row.id));
  return wanted.filter((id) => allowedIds.has(id));
}

/**
 * Cap verification texts per number per hour. Without this the endpoint is a
 * way to make the church pay to send texts to a stranger.
 */
async function tooManyCodes(phone: string): Promise<boolean> {
  const db = getDb();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await db
    .select({ id: verificationCodes.id })
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.phone, phone),
        gt(verificationCodes.createdAt, since),
        isNull(verificationCodes.consumedAt)
      )
    )
    .limit(MAX_CODES_PER_HOUR + 1);

  return recent.length >= MAX_CODES_PER_HOUR;
}

function clientIp(request: Request): string | null {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}
