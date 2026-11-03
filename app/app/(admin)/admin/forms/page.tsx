import { fmtDate, requireAdmin } from "../../../../../lib/members";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { Empty, Tabs } from "../../../ui";
import { markFormHandled } from "../actions";
import { base } from "../../../../../lib/members";

export const metadata = { title: "Forms" };

export default async function FormsAdmin({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();
  const b = await base();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const handled = sp.show === "handled";
  const { data } = await supabase.from("form_submissions").select("id,kind,data,created_at,handled_at,people(first_name,last_name,email,phone)").order("created_at", { ascending: false }).limit(200);
  const list = (data ?? []).filter((f) => (handled ? f.handled_at : !f.handled_at));
  return (
    <>
      <h1>Form submissions</h1>
      <Tabs current={handled ? `${b}/admin/forms?show=handled` : `${b}/admin/forms`} items={[["Open", `${b}/admin/forms`], ["Handled", `${b}/admin/forms?show=handled`]]} />
      {!list.length ? <Empty>Nothing here.</Empty> : list.map((f) => {
        const p = f.people as unknown as { first_name: string; last_name: string; email: string | null; phone: string | null } | null;
        return (
          <article key={f.id} className="ma-card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><h3 style={{ textTransform: "capitalize" }}>{f.kind}</h3><span className="ma-lead">{fmtDate(f.created_at)}</span></div>
            <p><strong>{p ? `${p.first_name} ${p.last_name}` : "Unknown"}</strong>{p?.email ? ` · ${p.email}` : ""}{p?.phone ? ` · ${p.phone}` : ""}</p>
            <dl style={{ margin: 0 }}>{Object.entries(f.data as Record<string, string>).map(([k, v]) => <div key={k} style={{ marginBottom: 6 }}><dt style={{ fontSize: ".66rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--blue)", fontWeight: 800 }}>{k.replace(/_/g, " ")}</dt><dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>{v}</dd></div>)}</dl>
            {!f.handled_at && <form action={markFormHandled} className="ma-actions"><input type="hidden" name="id" value={f.id} /><button className="button small navy" type="submit">Mark handled</button></form>}
          </article>
        );
      })}
    </>
  );
}
