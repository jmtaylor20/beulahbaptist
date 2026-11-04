import Link from "next/link";
import { notFound } from "next/navigation";
import { base, fmtDate, fmtTime, requireAdmin } from "../../../../../../lib/members";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { THEME_NAMES, emailConfigured } from "../../../../../../lib/email";
import { Notice } from "../../../../ui";
import { newsletterSources, previewNewsletter, sendNewsletter } from "../../actions";

export const metadata = { title: "Build email" };

export default async function NewsletterBuilder({ params, searchParams }: { params: Promise<{ newsletterId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const b = await base();
  const { newsletterId } = await params;
  const sp = await searchParams;
  const isNew = newsletterId === "new";
  const supabase = await supabaseServer();
  const { data: n } = isNew ? { data: null } : await supabase.from("newsletters").select("*").eq("id", newsletterId).maybeSingle();
  if (!isNew && !n) notFound();
  const src = await newsletterSources();
  const month = new Date().toLocaleString("en-US", { month: "long", timeZone: "America/Chicago" }).toLowerCase();
  const chosenA = new Set<string>(n?.announcement_ids ?? src.announcements.map((a) => a.id));
  const chosenE = new Set<string>(n?.event_ids ?? src.events.map((e) => e.id));
  const sent = !!n?.sent_at;

  return (
    <>
      <Link className="text-link" href={`${b}/admin/newsletter`}><span>←</span> Weekly email</Link>
      <h1 style={{ marginTop: 16 }}>{sent ? n!.subject : "Build this week's email"}</h1>
      {sent && <p className="ma-ok">Sent {fmtDate(n!.sent_at)} to {n!.recipient_count} members.</p>}
      {!emailConfigured() && <p className="ma-error">Email sending is not connected yet (RESEND_API_KEY). You can still build and preview.</p>}
      <Notice searchParams={sp} />

      {!sent && (
        <form className="ma-form" action={previewNewsletter}>
          <input type="hidden" name="id" value={n?.id ?? ""} />
          <section className="ma-card">
            <div className="row">
              <label>Subject<input name="subject" defaultValue={n?.subject ?? `This week at Beulah · ${fmtDate(new Date().toISOString(), { month: "long", day: "numeric" })}`} required /></label>
              <label>Look<select name="template" defaultValue={n?.template ?? month}>{Object.entries(THEME_NAMES).map(([k, name]) => <option key={k} value={k}>{name}{k === month ? " (this month)" : ""}</option>)}</select></label>
            </div>
            <label>A note from the office or pastor<textarea name="intro" rows={3} defaultValue={n?.intro ?? ""} /></label>
            <div className="row"><label>Verse<input name="verse_text" placeholder="Come to me, all you who are weary and burdened, and I will give you rest." /></label><label>Reference<input name="verse_ref" placeholder="Matthew 11:28" /></label></div>
          </section>

          <section className="ma-card">
            <h2>Announcements</h2>
            {!src.announcements.length ? <p className="ma-lead">No approved announcements. <Link href={`${b}/admin/announcements`}>Approve some first.</Link></p> : src.announcements.map((a) => <label key={a.id} className="check"><input type="checkbox" name="announcement" value={a.id} defaultChecked={chosenA.has(a.id)} /> {a.title}{a.image_path ? " 🖼" : ""}</label>)}
          </section>
          <section className="ma-card">
            <h2>Upcoming events (next 60 days)</h2>
            {!src.events.length ? <p className="ma-lead">Nothing on the calendar in the next 60 days.</p> : src.events.map((e) => <label key={e.id} className="check"><input type="checkbox" name="event" value={e.id} defaultChecked={chosenE.has(e.id)} /> {e.title} · {fmtDate(e.starts_at, { weekday: "short", month: "short", day: "numeric" })}{e.all_day ? "" : ` ${fmtTime(e.starts_at)}`}{e.image_path ? " 🖼" : ""}</label>)}
          </section>
          <section className="ma-card">
            <h2>Serving sign-ups</h2>
            {!src.serving.length ? <p className="ma-lead">No open sign-ups.</p> : src.serving.map((s) => <label key={s.id} className="check"><input type="checkbox" name="serving" value={s.id} defaultChecked /> {s.title} ({(s.serving_signups as unknown[]).length}{s.slots ? ` of ${s.slots}` : ""})</label>)}
          </section>
          <section className="ma-card">
            <h2>Celebrations and prayer</h2>
            <label className="check"><input type="checkbox" name="include_birthdays" defaultChecked={n?.include_birthdays ?? true} /> Birthdays and anniversaries this week ({src.birthdays.length + src.anniversaries.length})</label>
            {src.prayers.map((p) => <label key={p.id} className="check"><input type="checkbox" name="prayer" value={p.id} /> 🙏 {p.body.slice(0, 90)}{p.body.length > 90 ? "…" : ""}{p.name ? ` (${p.name})` : ""}</label>)}
            {!src.prayers.length && <p className="hint">No prayer requests marked OK for the email.</p>}
          </section>

          <div className="ma-actions">
            <button className="button navy" type="submit">Save and preview</button>
            <button className="button quiet" type="submit" name="test" value="1">Send me a test</button>
          </div>
        </form>
      )}

      {n?.html && (
        <section style={{ marginTop: 20 }}>
          <h2>Preview</h2>
          <div className="ma-preview"><iframe title="Newsletter preview" srcDoc={n.html} /></div>
          {!sent && (
            <form action={sendNewsletter} className="ma-actions" style={{ marginTop: 16 }}>
              <input type="hidden" name="id" value={n.id} />
              <button className="button gold" type="submit">Send to all {src.recipients.length} members</button>
              <span className="hint" style={{ alignSelf: "center" }}>Goes to every active member with an email on file.</span>
            </form>
          )}
        </section>
      )}
    </>
  );
}
