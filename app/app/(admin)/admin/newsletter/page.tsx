import Link from "next/link";
import { base, fmtDate, requireAdmin } from "../../../../../lib/members";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { Empty, Notice } from "../../../ui";

export const metadata = { title: "Newsletter" };

export default async function NewsletterList({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const b = await base();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("newsletters").select("id,subject,template,sent_at,recipient_count,created_at").order("created_at", { ascending: false }).limit(60);
  return (
    <>
      <h1>Weekly email</h1>
      <p className="ma-lead">Build it from this week&rsquo;s announcements, events, sign-ups and birthdays, send yourself a test, then send to everyone.</p>
      <Notice searchParams={sp} />
      <div className="ma-actions" style={{ marginBottom: 16 }}><Link className="button navy" href={`${b}/admin/newsletter/new`}>Build this week&rsquo;s email</Link></div>
      {!data?.length ? <Empty>No emails yet.</Empty> : (
        <div className="ma-list">{data.map((n) => (
          <Link key={n.id} href={`${b}/admin/newsletter/${n.id}`} className="ma-row">
            <div className="ma-row-text"><strong>{n.subject} {n.sent_at ? <span className="ma-badge green">sent</span> : <span className="ma-badge gold">draft</span>}</strong><small>{n.sent_at ? `Sent ${fmtDate(n.sent_at)} to ${n.recipient_count}` : `Started ${fmtDate(n.created_at)}`} · {n.template} look</small></div>
            <span className="ma-chevron">›</span>
          </Link>
        ))}</div>
      )}
    </>
  );
}
