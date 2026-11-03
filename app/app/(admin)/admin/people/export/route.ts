import { currentPerson } from "../../../../../../lib/members";
import { supabaseServer } from "../../../../../../lib/supabase/server";

// Full member export for the church office. Admins only.
export async function GET() {
  const me = await currentPerson();
  if (!me?.is_admin || me.status !== "active") return new Response("Not allowed", { status: 403 });
  const supabase = await supabaseServer();
  const [{ data: people }, { data: households }] = await Promise.all([
    supabase.from("people").select("*").order("last_name").order("first_name"),
    supabase.from("households").select("*"),
  ]);
  const hh = new Map((households ?? []).map((h) => [h.id, h]));
  const cols = ["last_name", "first_name", "status", "role", "is_minor", "is_admin", "email", "phone", "birthday", "household", "address", "city", "state", "zip", "home_phone", "anniversary", "bio", "admin_notes", "created_at"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = (people ?? []).map((p) => {
    const h = hh.get(p.household_id);
    return cols.map((c) => esc(["household", "address", "city", "state", "zip", "home_phone", "anniversary"].includes(c) ? (c === "household" ? h?.name : h?.[c]) : p[c])).join(",");
  });
  return new Response([cols.join(","), ...rows].join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="beulah-members-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
