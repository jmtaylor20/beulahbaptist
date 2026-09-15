import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { groups, members } from "../../../../../db/schema";
import { requireStaff } from "../../../../../lib/auth";
import { extractContacts, parseCsv } from "../../../../../lib/csv";
import { isValidEmail } from "../../../../../lib/email";
import { addMemberToGroups, recordConsent } from "../../../../../lib/members";
import { parseUsPhone } from "../../../../../lib/phone";

export const dynamic = "force-dynamic";

interface RowOutcome {
  rowNumber: number;
  name: string;
  reason: string;
}

/**
 * Import contacts from a Flocknote (or similar) CSV export.
 *
 * The consent question is the important one here. People on the existing
 * Flocknote list already agreed to receive church texts, so importing them as
 * subscribed is legitimate -- but only if that is a deliberate, recorded
 * decision. `smsConsent` makes the operator state it, and every imported row
 * gets a consent event naming the file it came from, so the church can show
 * where the permission originated.
 */
export async function POST(request: Request) {
  const auth = await requireStaff(request);
  if (auth.response) return auth.response;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const smsConsent = form.get("smsConsent") === "true";
    const dryRun = form.get("dryRun") === "true";
    const sourceNote = String(form.get("sourceNote") ?? "").slice(0, 300);

    if (!(file instanceof File)) {
      return Response.json({ error: "No CSV file was uploaded." }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return Response.json(
        { error: "That file is over 5MB. Split it and import in parts." },
        { status: 400 }
      );
    }

    const { contacts, columns } = extractContacts(parseCsv(await file.text()));

    if (columns.phone === undefined && columns.email === undefined) {
      return Response.json(
        {
          error:
            "No phone or email column found. The file needs a header row with a column named Phone, Mobile, or Email.",
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const groupCache = await loadGroupsByName();
    const seenPhones = new Set<string>();

    let created = 0;
    let updated = 0;
    const skipped: RowOutcome[] = [];

    for (const contact of contacts) {
      const label =
        `${contact.firstName} ${contact.lastName}`.trim() ||
        contact.phone ||
        contact.email ||
        `row ${contact.rowNumber}`;

      let phone: string | null = null;
      if (contact.phone) {
        const parsed = parseUsPhone(contact.phone);
        if (parsed.ok) {
          phone = parsed.e164;
        } else {
          skipped.push({
            rowNumber: contact.rowNumber,
            name: label,
            reason: parsed.reason,
          });
          continue;
        }
      }

      const email =
        contact.email && isValidEmail(contact.email)
          ? contact.email.trim().toLowerCase()
          : null;

      if (!phone && !email) {
        skipped.push({
          rowNumber: contact.rowNumber,
          name: label,
          reason: "No usable phone number or email address.",
        });
        continue;
      }

      // A duplicate inside the same file would otherwise overwrite the earlier
      // row and report as an update, which is confusing.
      if (phone && seenPhones.has(phone)) {
        skipped.push({
          rowNumber: contact.rowNumber,
          name: label,
          reason: "Duplicate of an earlier row in this file.",
        });
        continue;
      }
      if (phone) seenPhones.add(phone);

      if (dryRun) {
        created += 1;
        continue;
      }

      const existing = phone
        ? (
            await db
              .select()
              .from(members)
              .where(eq(members.phone, phone))
              .limit(1)
          )[0]
        : email
          ? (
              await db
                .select()
                .from(members)
                .where(eq(members.email, email))
                .limit(1)
            )[0]
          : undefined;

      const smsStatus = phone && smsConsent ? ("confirmed" as const) : undefined;
      const emailStatus = email ? ("confirmed" as const) : undefined;

      let memberId: number;

      if (existing) {
        // Never resurrect someone who opted out: an old export must not undo a
        // STOP they sent last month.
        const canSetSms =
          smsStatus &&
          existing.smsStatus !== "opted_out" &&
          existing.smsStatus !== "undeliverable";
        const canSetEmail = emailStatus && existing.emailStatus !== "opted_out";

        await db
          .update(members)
          .set({
            firstName: contact.firstName || existing.firstName,
            lastName: contact.lastName || existing.lastName,
            phone: phone ?? existing.phone,
            email: email ?? existing.email,
            ...(canSetSms ? { smsStatus } : {}),
            ...(canSetEmail ? { emailStatus } : {}),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(members.id, existing.id));
        memberId = existing.id;
        updated += 1;
      } else {
        const [row] = await db
          .insert(members)
          .values({
            firstName: contact.firstName,
            lastName: contact.lastName,
            phone,
            email,
            smsStatus: phone ? (smsConsent ? "confirmed" : "none") : "none",
            emailStatus: email ? "confirmed" : "none",
          })
          .returning();
        memberId = row.id;
        created += 1;
      }

      if (phone && smsConsent) {
        await recordConsent({
          memberId,
          phone,
          email,
          channel: "sms",
          action: "opt_in_confirmed",
          context: {
            source: "import",
            evidence:
              `Imported from "${file.name}" (row ${contact.rowNumber}). ` +
              `Staff attested prior consent on the previous platform. ${sourceNote}`.trim(),
          },
        });
      }

      const groupIds = contact.groups
        .map((name) => groupCache.get(name.toLowerCase()))
        .filter((id): id is number => id !== undefined);
      if (groupIds.length) await addMemberToGroups(memberId, groupIds);
    }

    return Response.json({
      ok: true,
      dryRun,
      total: contacts.length,
      created,
      updated,
      skipped: skipped.slice(0, 100),
      skippedCount: skipped.length,
    });
  } catch (error) {
    console.error("[admin/members/import] failed", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "The import could not run.",
      },
      { status: 500 }
    );
  }
}

async function loadGroupsByName(): Promise<Map<string, number>> {
  const db = getDb();
  const rows = await db.select({ id: groups.id, name: groups.name }).from(groups);
  return new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));
}
