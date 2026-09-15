import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { groups } from "../../../../../db/schema";
import { requireStaff } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaff(request);
  if (auth.response) return auth.response;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Unknown group." }, { status: 404 });
  }

  try {
    const payload = (await request.json()) as {
      name?: string;
      description?: string;
      selfServe?: boolean;
    };

    const patch: Record<string, unknown> = {};
    if (payload.name !== undefined) {
      const name = payload.name.trim().slice(0, 80);
      if (!name) {
        return Response.json({ error: "Give the group a name." }, { status: 400 });
      }
      patch.name = name;
    }
    if (payload.description !== undefined) {
      patch.description = payload.description.trim().slice(0, 300);
    }
    if (payload.selfServe !== undefined) {
      patch.selfServe = payload.selfServe;
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ ok: true });
    }

    const db = getDb();
    await db.update(groups).set(patch).where(eq(groups.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[admin/groups] update failed", error);
    return Response.json(
      { error: "The group could not be updated." },
      { status: 500 }
    );
  }
}

/**
 * Delete a group. Memberships cascade, but members themselves are untouched --
 * deleting "Choir" must never delete the choir.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaff(request);
  if (auth.response) return auth.response;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Unknown group." }, { status: 404 });
  }

  try {
    const db = getDb();
    await db.delete(groups).where(eq(groups.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[admin/groups] delete failed", error);
    return Response.json(
      { error: "The group could not be deleted." },
      { status: 500 }
    );
  }
}
