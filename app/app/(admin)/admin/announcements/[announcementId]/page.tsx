import Link from "next/link";
import { notFound } from "next/navigation";
import { base, publicMediaUrl, requireAdmin } from "../../../../../../lib/members";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { Notice } from "../../../../ui";
import { deleteAnnouncement, polish, revertPolish, saveAnnouncement } from "../../actions";
import { PhotoInput } from "../../../../PhotoInput";

export const metadata = { title: "Announcement" };

export default async function AnnouncementAdmin({ params, searchParams }: { params: Promise<{ announcementId: string }>; searchParams: Promise<{ ok?: string; error?: string; kind?: string }> }) {
  await requireAdmin();
  const b = await base();
  const { announcementId } = await params;
  const sp = await searchParams;
  const isNew = announcementId === "new";
  const supabase = await supabaseServer();
  const { data } = isNew ? { data: null } : await supabase.from("announcements").select("*,people!submitted_by(first_name,last_name),serving_signups(note,people(first_name,last_name))").eq("id", announcementId).maybeSingle();
  if (!isNew && !data) notFound();
  const a = data ?? { id: "", kind: sp.kind === "serving" ? "serving" : "announcement", title: "", body: "", body_original: null, image_path: null, link_url: "", starts_on: "", ends_on: "", slots: null, show_on_website: true, status: "draft", people: null, serving_signups: [] };
  const by = a.people as unknown as { first_name: string; last_name: string } | null;
  const changed = !!a.body_original && a.body_original !== a.body;
  const signups = (a.serving_signups ?? []) as { note: string | null; people: { first_name: string; last_name: string } | null }[];

  return (
    <>
      <Link className="text-link" href={`${b}/admin/announcements`}><span>←</span> Announcements</Link>
      <h1 style={{ marginTop: 16 }}>{isNew ? (a.kind === "serving" ? "New serving sign-up" : "New announcement") : a.title}</h1>
      {by && <p className="ma-lead">Suggested by {by.first_name} {by.last_name}</p>}
      <Notice searchParams={sp} />

      {isNew && a.kind === "announcement" && <p className="ma-ok">Has a date? <Link href={`${b}/admin/events/new`} style={{ fontWeight: 800 }}>Create it as an event instead</Link>. Events go on the calendar, the church website and the weekly email with their flyer, so there is no need to enter them twice. Announcements are for things without a date.</p>}
      <form className="ma-form" action={saveAnnouncement} encType="multipart/form-data" id="announcement-form">
        <input type="hidden" name="id" value={a.id} />
        <section className="ma-card">
          <label>Type<select name="kind" defaultValue={a.kind}><option value="announcement">Announcement</option><option value="serving">Serving sign-up</option></select></label>
          <label>Title<input name="title" defaultValue={a.title} required /></label>
          <label>Text<textarea name="body" rows={7} defaultValue={a.body ?? ""} placeholder="Type or paste the announcement. Use Polish to clean it up before it goes out." /></label>
          {!isNew && (
            <div className="ma-actions">
              <button className="button small gold" type="submit" formAction={polish}>✨ Polish wording</button>
              {changed && <button className="button small quiet" type="submit" formAction={revertPolish}>Restore original</button>}
            </div>
          )}
          {changed && <div className="ma-diff"><div><b>Original</b>{a.body_original}</div><div><b>Current</b>{a.body}</div></div>}
          {publicMediaUrl(a.image_path) && <img src={publicMediaUrl(a.image_path)!} alt="" style={{ maxWidth: 360, borderRadius: 10 }} />}
          <label>Picture or flyer<PhotoInput name="image" /></label>
          <label>Link<input name="link_url" type="url" defaultValue={a.link_url ?? ""} placeholder="https://" /></label>
          <div className="row"><label>Show from<input name="starts_on" type="date" defaultValue={a.starts_on ?? ""} /></label><label>Until<input name="ends_on" type="date" defaultValue={a.ends_on ?? ""} /><span className="hint">Drops out of the app and email after this date.</span></label></div>
          <label className="check"><input type="checkbox" name="show_on_website" defaultChecked={a.show_on_website ?? true} /> Show on church website <span className="hint">Approved announcements appear in the carousel at the top of the home page. Untick for members-only news. Serving sign-ups never show.</span></label>
          <label>Spots needed (serving only)<input name="slots" type="number" min={1} defaultValue={a.slots ?? ""} /></label>
          <label>Status<select name="status" defaultValue={a.status}><option value="suggested">Suggested</option><option value="draft">Draft</option><option value="approved">Approved (live)</option><option value="archived">Archived</option></select></label>
        </section>
        <div className="ma-actions">
          <button className="button navy" type="submit">Save</button>
          {a.status !== "approved" && <button className="button gold" type="submit" name="approve" value="1">Save and approve</button>}
        </div>
      </form>

      {signups.length > 0 && <section className="ma-card" style={{ marginTop: 16 }}><h2>Signed up ({signups.length})</h2>{signups.map((s, i) => <p key={i} style={{ margin: "0 0 4px" }}>{s.people ? `${s.people.first_name} ${s.people.last_name}` : "Member"}{s.note ? ` · ${s.note}` : ""}</p>)}</section>}
      {!isNew && <form action={deleteAnnouncement} style={{ marginTop: 30 }}><input type="hidden" name="id" value={a.id} /><button className="button small danger" type="submit">Delete</button></form>}
    </>
  );
}
