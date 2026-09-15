import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { members } from "../../../../../db/schema";
import { requireStaff } from "../../../../../lib/auth";
import {
  optOutEmail,
  optOutPhone,
  setMemberGroups,
} from "../../../../../lib/members";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaff(request);
  if (auth.response) return auth.response;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Unknown member." }, { status: 404 });
  }

  try {
    const payload = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      notes?: string;
      groupIds?: number[];
      unsubscribeSms?: boolean;
      unsubscribeEmail?: boolean;
    };

    const db = getDb();
    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.id, id))
      .limit(1);

    if (!member) {
      return Response.json({ error: "Unknown member." }, { status: 404 });
    }

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (payload.firstName !== undefined) {
      patch.firstName = payload.firstName.trim().slice(0, 80);
    }
    if (payload.lastName !== undefined) {
      patch.lastName = payload.lastName.trim().slice(0, 80);
    }
    if (payload.notes !== undefined) {
      patch.notes = payload.notes.slice(0, 2000);
    }

    await db.update(members).set(patch).where(eq(members.id, id));

    if (payload.groupIds) {
      await setMemberGroups(
        id,
        payload.groupIds
          .map((groupId) => Number(groupId))
          .filter((groupId) => Number.isInteger(groupId) && groupId > 0)
      );
    }

    // Opting someone out goes through the consent helpers rather than a plain
    // column write, so the reason lands in the audit trail.
    if (payload.unsubscribeSms && member.phone) {
      await optOutPhone({
        phone: member.phone,
        context: {
          source: "admin",
          evidence: `Removed from texts by ${auth.user.email}.`,
        },
      });
    }
    if (payload.unsubscribeEmail && member.email) {
      await optOutEmail({
        email: member.email,
        context: {
          source: "admin",
          evidence: `Removed from email by ${auth.user.email}.`,
        },
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[admin/members] update failed", error);
    return Response.json(
      { error: "The member could not be updated." },
      { status: 500 }
    );
  }
}

/**
 * Delete a member outright.
 *
 * Their consent events are kept (the foreign key nulls the member reference
 * rather than cascading), because the record of a STOP has to outlive the
 * record of the person -- otherwise a later import could re-add someone who
 * had already opted out.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaff(request);
  if (auth.response) return auth.response;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Unknown member." }, { status: 404 });
  }

  try {
    const db = getDb();
    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.id, id))
      .limit(1);

    if (!member) {
      return Response.json({ error: "Unknown member." }, { status: 404 });
    }

    if (member.phone && member.smsStatus === "confirmed") {
      await optOutPhone({
        phone: member.phone,
        context: {
          source: "admin",
          evidence: `Member deleted by ${auth.user.email}.`,
        },
      });
    }

    await db.delete(members).where(eq(members.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[admin/members] delete failed", error);
    return Response.json(
      { error: "The member could not be deleted." },
      { status: 500 }
    );
  }
}
