import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { members } from "../../../../db/schema";
import { requireStaff } from "../../../../lib/auth";
import { isValidEmail } from "../../../../lib/email";
import { addMemberToGroups, recordConsent } from "../../../../lib/members";
import { parseUsPhone } from "../../../../lib/phone";

export const dynamic = "force-dynamic";

/**
 * Add one member by hand.
 *
 * Unlike the public signup this skips double opt-in, because the office is
 * attesting that the person asked to be added -- at a welcome desk, on a
 * connection card, or over the phone. That attestation is recorded as the
 * consent evidence, so the trail still shows where permission came from.
 */
export async function POST(request: Request) {
  const auth = await requireStaff(request);
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      groupIds?: number[];
      consentNote?: string;
      subscribeSms?: boolean;
    };

    const firstName = (payload.firstName ?? "").trim().slice(0, 80);
    const lastName = (payload.lastName ?? "").trim().slice(0, 80);

    let phone: string | null = null;
    if ((payload.phone ?? "").trim()) {
      const parsed = parseUsPhone(payload.phone ?? "");
      if (!parsed.ok) return Response.json({ error: parsed.reason }, { status: 400 });
      phone = parsed.e164;
    }

    const rawEmail = (payload.email ?? "").trim().toLowerCase();
    if (rawEmail && !isValidEmail(rawEmail)) {
      return Response.json(
        { error: "That email address doesn't look right." },
        { status: 400 }
      );
    }
    const email = rawEmail || null;

    if (!phone && !email) {
      return Response.json(
        { error: "Add at least a phone number or an email address." },
        { status: 400 }
      );
    }

    const consentNote = (payload.consentNote ?? "").trim();
    const subscribeSms = phone !== null && payload.subscribeSms !== false;

    if (subscribeSms && !consentNote) {
      return Response.json(
        {
          error:
            "Record how this person gave permission to be texted (for example: 'signed a connection card on 8/24').",
        },
        { status: 400 }
      );
    }

    const db = getDb();

    if (phone) {
      const [clash] = await db
        .select({ id: members.id })
        .from(members)
        .where(eq(members.phone, phone))
        .limit(1);
      if (clash) {
        return Response.json(
          { error: "Someone with that phone number is already on the list." },
          { status: 409 }
        );
      }
    }

    const [member] = await db
      .insert(members)
      .values({
        firstName,
        lastName,
        phone,
        email,
        smsStatus: phone ? (subscribeSms ? "confirmed" : "none") : "none",
        emailStatus: email ? "confirmed" : "none",
      })
      .returning();

    if (subscribeSms && phone) {
      await recordConsent({
        memberId: member.id,
        phone,
        email,
        channel: "sms",
        action: "opt_in_confirmed",
        context: {
          source: "admin",
          evidence: `Added by ${auth.user.email}. Consent: ${consentNote}`,
        },
      });
    }

    const groupIds = (payload.groupIds ?? [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (groupIds.length) await addMemberToGroups(member.id, groupIds);

    return Response.json({ ok: true, member });
  } catch (error) {
    console.error("[admin/members] create failed", error);
    return Response.json(
      { error: "The member could not be added." },
      { status: 500 }
    );
  }
}
