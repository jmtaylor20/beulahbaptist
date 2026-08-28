import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { groups } from "../../../../db/schema";
import { requireStaff } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireStaff(request);
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as {
      name?: string;
      description?: string;
      selfServe?: boolean;
    };

    const name = (payload.name ?? "").trim().slice(0, 80);
    if (!name) {
      return Response.json({ error: "Give the group a name." }, { status: 400 });
    }

    const slug = slugify(name);
    const db = getDb();

    const [clash] = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.slug, slug))
      .limit(1);

    if (clash) {
      return Response.json(
        { error: "A group with that name already exists." },
        { status: 409 }
      );
    }

    const [group] = await db
      .insert(groups)
      .values({
        name,
        slug,
        description: (payload.description ?? "").trim().slice(0, 300),
        selfServe: payload.selfServe !== false,
      })
      .returning();

    return Response.json({ ok: true, group });
  } catch (error) {
    console.error("[admin/groups] create failed", error);
    return Response.json(
      { error: "The group could not be created." },
      { status: 500 }
    );
  }
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "group"
  );
}
