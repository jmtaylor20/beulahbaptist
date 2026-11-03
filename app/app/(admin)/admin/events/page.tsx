import Link from "next/link";
import { base, fmtDate, fmtTime, requireAdmin } from "../../../../../lib/members";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { Empty, Notice } from "../../../ui";

export const metadata = { title: "Events" };

export default async function EventsAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; past?: string }> }) {
  await requireAdmin();
  const b = await base();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const now = new Date().getTime();
  let query = supabase.from("events").select("id,title,starts_at,all_day,location,status,rsvp_enabled,event_rsvps(headcount)").order("starts_at", { ascending: !sp.past }).limit(200);
  query = sp.past ? query.lt("starts_at", new Date().toISOString()) : query.gte("starts_at", new Date(now - 86400000).toISOString());
  const { data } = await query;
  return (
    <>
      <h1>Events</h1>
      <Notice searchParams={sp} />
      <div className="ma-actions" style={{ marginBottom: 14 }}><Link className="button small navy" href={`${b}/admin/events/new`}>New event</Link><Link className="button small quiet" href={sp.past ? `${b}/admin/events` : `${b}/admin/events?past=1`}>{sp.past ? "Upcoming" : "Past events"}</Link></div>
      {!data?.length ? <Empty>No events.</Empty> : (
        <div className="ma-list">{data.map((e) => (
          <Link key={e.id} href={`${b}/admin/events/${e.id}`} className="ma-row">
            <div className="ma-row-text"><strong>{e.title} {e.status === "suggested" && <span className="ma-badge gold">suggested</span>}{e.status === "draft" && <span className="ma-badge">draft</span>}{e.status === "archived" && <span className="ma-badge red">archived</span>}</strong>
              <small>{fmtDate(e.starts_at, { weekday: "short", month: "short", day: "numeric" })}{e.all_day ? "" : ` ${fmtTime(e.starts_at)}`}{e.location ? ` · ${e.location}` : ""}{e.rsvp_enabled ? ` · ${(e.event_rsvps as { headcount: number }[]).reduce((s, r) => s + r.headcount, 0)} going` : ""}</small></div>
            <span className="ma-chevron">›</span>
          </Link>
        ))}</div>
      )}
    </>
  );
}
