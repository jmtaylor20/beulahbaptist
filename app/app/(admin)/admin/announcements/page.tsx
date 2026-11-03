import Link from "next/link";
import { base, fmtDate, requireAdmin } from "../../../../../lib/members";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { Empty, Notice, Tabs } from "../../../ui";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsAdmin({ searchParams }: { searchParams: Promise<{ status?: string; ok?: string; error?: string }> }) {
  await requireAdmin();
  const b = await base();
  const sp = await searchParams;
  const status = sp.status ?? "approved";
  const supabase = await supabaseServer();
  const [{ data }, counts] = await Promise.all([
    supabase.from("announcements").select("id,kind,title,status,starts_on,ends_on,created_at,people!submitted_by(first_name,last_name)").eq("status", status).order("created_at", { ascending: false }).limit(200),
    Promise.all(["suggested", "draft", "approved", "archived"].map((s) => supabase.from("announcements").select("id", { count: "exact", head: true }).eq("status", s).then((r) => r.count ?? 0))),
  ]);
  return (
    <>
      <h1>Announcements</h1>
      <Notice searchParams={sp} />
      <Tabs current={`${b}/admin/announcements?status=${status}`} items={[["Suggested", `${b}/admin/announcements?status=suggested`, counts[0]], ["Drafts", `${b}/admin/announcements?status=draft`, counts[1]], ["Live", `${b}/admin/announcements?status=approved`, counts[2]], ["Archived", `${b}/admin/announcements?status=archived`, counts[3]]]} />
      <div className="ma-actions" style={{ marginBottom: 14 }}><Link className="button small navy" href={`${b}/admin/announcements/new`}>New announcement</Link><Link className="button small quiet" href={`${b}/admin/announcements/new?kind=serving`}>New serving sign-up</Link></div>
      {!data?.length ? <Empty>Nothing here.</Empty> : (
        <div className="ma-list">{data.map((a) => {
          const by = a.people as unknown as { first_name: string; last_name: string } | null;
          return (
            <Link key={a.id} href={`${b}/admin/announcements/${a.id}`} className="ma-row">
              <div className="ma-row-text"><strong>{a.title} {a.kind === "serving" && <span className="ma-badge blue">serving</span>}</strong><small>{by ? `From ${by.first_name} ${by.last_name} · ` : ""}{fmtDate(a.created_at)}{a.ends_on ? ` · until ${fmtDate(a.ends_on)}` : ""}</small></div>
              <span className="ma-chevron">›</span>
            </Link>
          );
        })}</div>
      )}
    </>
  );
}
