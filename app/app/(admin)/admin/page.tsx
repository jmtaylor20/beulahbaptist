import Link from "next/link";
import { base, fmtDate, requireAdmin } from "../../../../lib/members";
import { supabaseServer } from "../../../../lib/supabase/server";
import { Empty } from "../../ui";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  const [{ data: pending }, { data: announcements }, { data: events }, { data: forms }, { count: members }, { data: lastNewsletter }] = await Promise.all([
    supabase.from("people").select("id,first_name,last_name,email,created_at,request_note").eq("status", "pending").order("created_at"),
    supabase.from("announcements").select("id,title,kind,created_at").eq("status", "suggested").order("created_at"),
    supabase.from("events").select("id,title,starts_at").eq("status", "suggested").order("starts_at"),
    supabase.from("form_submissions").select("id,kind,created_at").is("handled_at", null).order("created_at"),
    supabase.from("people").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("newsletters").select("subject,sent_at,recipient_count").not("sent_at", "is", null).order("sent_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const total = (pending?.length ?? 0) + (announcements?.length ?? 0) + (events?.length ?? 0) + (forms?.length ?? 0);

  return (
    <>
      <h1>Queue</h1>
      <p className="ma-lead">{members ?? 0} active members · {lastNewsletter ? `Last email "${lastNewsletter.subject}" went to ${lastNewsletter.recipient_count} people on ${fmtDate(lastNewsletter.sent_at)}` : "No newsletter sent yet"}</p>
      {!total && <Empty>Nothing waiting on you. 🎉</Empty>}

      {!!pending?.length && <section className="ma-card"><h2>Access requests <span className="ma-count">{pending.length}</span></h2>
        <div className="ma-list">{pending.map((p) => <Link key={p.id} href={`${b}/admin/people/${p.id}`} className="ma-row"><div className="ma-row-text"><strong>{p.first_name} {p.last_name}</strong><small>{p.email} · {fmtDate(p.created_at)}{p.request_note ? ` · "${p.request_note}"` : ""}</small></div><span className="ma-chevron">›</span></Link>)}</div></section>}

      {!!announcements?.length && <section className="ma-card"><h2>Suggested announcements <span className="ma-count">{announcements.length}</span></h2>
        <div className="ma-list">{announcements.map((a) => <Link key={a.id} href={`${b}/admin/announcements/${a.id}`} className="ma-row"><div className="ma-row-text"><strong>{a.title}</strong><small>{a.kind === "serving" ? "Serving sign-up" : "Announcement"} · {fmtDate(a.created_at)}</small></div><span className="ma-chevron">›</span></Link>)}</div></section>}

      {!!events?.length && <section className="ma-card"><h2>Suggested events <span className="ma-count">{events.length}</span></h2>
        <div className="ma-list">{events.map((e) => <Link key={e.id} href={`${b}/admin/events/${e.id}`} className="ma-row"><div className="ma-row-text"><strong>{e.title}</strong><small>{fmtDate(e.starts_at)}</small></div><span className="ma-chevron">›</span></Link>)}</div></section>}

      {!!forms?.length && <section className="ma-card"><h2>Form submissions <span className="ma-count">{forms.length}</span></h2>
        <div className="ma-list">{forms.map((f) => <Link key={f.id} href={`${b}/admin/forms`} className="ma-row"><div className="ma-row-text"><strong style={{ textTransform: "capitalize" }}>{f.kind}</strong><small>{fmtDate(f.created_at)}</small></div><span className="ma-chevron">›</span></Link>)}</div></section>}

      <div className="ma-grid tiles" style={{ marginTop: 10 }}>
        <Link className="ma-tile" href={`${b}/admin/newsletter`}><span>✉️</span><strong>Build this week&rsquo;s email</strong><small>Announcements, events, birthdays</small></Link>
        <Link className="ma-tile" href={`${b}/admin/announcements/new`}><span>📣</span><strong>New announcement</strong><small>Photo or text</small></Link>
        <Link className="ma-tile" href={`${b}/admin/events/new`}><span>📅</span><strong>New event</strong><small>Add to the calendar</small></Link>
        <Link className="ma-tile" href={`${b}/admin/people`}><span>👥</span><strong>People</strong><small>Households, records, export</small></Link>
      </div>
    </>
  );
}
