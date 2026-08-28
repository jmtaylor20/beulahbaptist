import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { verificationCodes } from "../../../../db/schema";
import { getChurchConfig } from "../../../../lib/config";
import {
  confirmPhoneSignup,
  findMemberByPhone,
} from "../../../../lib/members";
import { parseUsPhone } from "../../../../lib/phone";
import { hashCode, isExpired } from "../../../../lib/tokens";
import { timingSafeEqual } from "../../../../lib/twilio";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;

/**
 * Step two of double opt-in. A correct code is the proof that the person
 * filling in the form is holding the phone.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      phone?: string;
      code?: string;
    };

    const parsed = parseUsPhone(payload.phone ?? "");
    if (!parsed.ok) {
      return Response.json({ error: parsed.reason }, { status: 400 });
    }

    const code = (payload.code ?? "").replace(/\D/g, "");
    if (code.length !== 6) {
      return Response.json(
        { error: "Enter the 6-digit code we texted you." },
        { status: 400 }
      );
    }

    const db = getDb();
    const [row] = await db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.phone, parsed.e164),
          isNull(verificationCodes.consumedAt)
        )
      )
      .orderBy(desc(verificationCodes.id))
      .limit(1);

    if (!row) {
      return Response.json(
        { error: "That code has expired. Request a new one." },
        { status: 400 }
      );
    }

    if (isExpired(row.expiresAt)) {
      return Response.json(
        { error: "That code has expired. Request a new one." },
        { status: 400 }
      );
    }

    if (row.attempts >= MAX_ATTEMPTS) {
      return Response.json(
        {
          error:
            "Too many incorrect attempts. Request a new code to try again.",
        },
        { status: 429 }
      );
    }

    const expected = await hashCode(code, parsed.e164);
    if (!timingSafeEqual(expected, row.codeHash)) {
      await db
        .update(verificationCodes)
        .set({ attempts: row.attempts + 1 })
        .where(eq(verificationCodes.id, row.id));

      const remaining = MAX_ATTEMPTS - (row.attempts + 1);
      return Response.json(
        {
          error:
            remaining > 0
              ? `That code didn't match. ${remaining} ${
                  remaining === 1 ? "try" : "tries"
                } left.`
              : "Too many incorrect attempts. Request a new code.",
        },
        { status: 400 }
      );
    }

    const member = await findMemberByPhone(parsed.e164);
    if (!member) {
      return Response.json(
        { error: "We couldn't find that signup. Please start again." },
        { status: 400 }
      );
    }

    // Burn the code first so a replay cannot re-confirm.
    await db
      .update(verificationCodes)
      .set({ consumedAt: new Date().toISOString() })
      .where(eq(verificationCodes.id, row.id));

    await confirmPhoneSignup({
      memberId: member.id,
      phone: parsed.e164,
      context: {
        source: "web_form",
        evidence: `Confirmed by replying with the 6-digit code texted to ${parsed.e164}.`,
        ipAddress:
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null,
        userAgent: request.headers.get("user-agent"),
      },
    });

    return Response.json({
      ok: true,
      churchName: getChurchConfig().name,
    });
  } catch (error) {
    console.error("[signup/verify] failed", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
