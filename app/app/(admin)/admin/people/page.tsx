import Link from "next/link";
import { base, fmtDate, requireAdmin, type Person } from "../../../../../lib/members";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { Empty, Notice, Tabs } from "../../../ui";
import { createHousehold } from "../actions";

export const metadata = { title: "People" };

export default async function People({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; ok?: string; error?: string }> }) {
  await requireAdmin();
  const b = await base();
  const sp = await searchParams;
  const status = sp.status ?? "active";
  const supabase = await supabaseServer();
  const [{ data: people }, { data: households }, counts] = await Promise.all([
    supabase.from("people").select("*").eq("status", status).order("last_name").order("first_name"),
    supabase.from("households").select("id,name").order("name"),
    Promise.all(["pending", "active", "inactive"].map((s) => supabase.from("people").select("id", { count: "exact", head: true }).eq("status", s).then((r) => r.count ?? 0))),
  ]);
  const hh = new Map((households ?? []).map((h) => [h.id, h.name]));
  const q = (sp.q ?? "").toLowerCase();
  const list = ((people ?? []) as Person[]).filter((p) => !q || `${p.first_name} ${p.last_name} ${p.email ?? ""} ${hh.get(p.household_id ?? "") ?? ""}`.toLowerCase().includes(q));

  return (
    <>
      <h1>People</h1>
      <Notice searchParams={sp} />
      <Tabs current={`${b}/admin/people?status=${status}`} items={[["Pending", `${b}/admin/people?status=pending`, counts[0]], ["Active", `${b}/admin/people?status=active`, counts[1]], ["Inactive", `${b}/admin/people?status=inactive`, counts[2]]]} />
      <form className="ma-search" method="get"><input type="hidden" name="status" value={status} /><input name="q" defaultValue={sp.q} placeholder="Search people" /></form>
      <div className="ma-actions" style={{ marginBottom: 14 }}>
        <Link className="button small navy" href={`${b}/admin/people/new`}>Add person</Link>
        <a className="button small quiet" href={`${b}/admin/people/export`}>Download CSV</a>
      </div>
      {!list.length ? <Empty>No one here.</Empty> : (
        <div className="ma-list">
          {list.map((p) => (
            <Link key={p.id} href={`${b}/admin/people/${p.id}`} className="ma-row">
              <div className="ma-row-text"><strong>{p.last_name}, {p.first_name} {p.is_admin && <span className="ma-badge gold">admin</span>} {p.is_minor && <span className="ma-badge">child</span>}</strong>
                <small>{hh.get(p.household_id ?? "") ?? "No household"} · {p.email ?? "no email"} · {p.phone ?? "no phone"}{status === "pending" ? ` · requested ${fmtDate(p.created_at)}` : ""}</small></div>
              <span className="ma-chevron">›</span>
            </Link>
          ))}
        </div>
      )}
      <details className="ma-card" style={{ marginTop: 20 }}>
        <summary style={{ cursor: "pointer", fontWeight: 800, color: "var(--navy)" }}>Households ({households?.length ?? 0})</summary>
        <form className="ma-form" action={createHousehold} style={{ marginTop: 12 }}><div className="row"><label>New household name<input name="name" placeholder="The Taylor Family" required /></label><button className="button small navy" type="submit" style={{ alignSelf: "end" }}>Create</button></div></form>
        <ul style={{ columns: 2, fontSize: ".9rem", marginTop: 12 }}>{(households ?? []).map((h) => <li key={h.id}><Link href={`${b}/admin/people/household/${h.id}`}>{h.name}</Link></li>)}</ul>
      </details>
    </>
  );
}
