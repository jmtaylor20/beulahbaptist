import Link from "next/link";
import { notFound } from "next/navigation";
import { base, publicMediaUrl, requireAdmin } from "../../../../../../lib/members";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { Notice } from "../../../../ui";
import { deleteEvent, saveEvent } from "../../actions";
import { PhotoInput } from "../../../../PhotoInput";

export const metadata = { title: "Event" };

// Date and time boxes are separate: phones handle those far better than a
// combined picker. Values are shown in Central time.
const local = (iso: string | null) => (iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "America/Chicago" }).slice(0, 16) : "");
const datePart = (iso: string | null) => local(iso).slice(0, 10);
const timePart = (iso: string | null) => local(iso).slice(11, 16);

export default async function EventAdmin({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const b = await base();
  const { eventId } = await params;
  const sp = await searchParams;
  const isNew = eventId === "new";
  const supabase = await supabaseServer();
  const { data } = isNew ? { data: null } : await supabase.from("events").select("*,people!submitted_by(first_name,last_name),event_rsvps(headcount,people(first_name,last_name))").eq("id", eventId).maybeSingle();
  if (!isNew && !data) notFound();
  const e = data ?? { id: "", title: "", description: "", location: "", starts_at: null, ends_at: null, all_day: false, image_path: null, rsvp_enabled: false, show_on_website: true, status: "approved", people: null, event_rsvps: [] };
  const by = e.people as unknown as { first_name: string; last_name: string } | null;
  return (
    <>
      <Link className="text-link" href={`${b}/admin/events`}><span>←</span> Events</Link>
      <h1 style={{ marginTop: 16 }}>{isNew ? "New event" : e.title}</h1>
      {by && <p className="ma-lead">Suggested by {by.first_name} {by.last_name}</p>}
      <Notice searchParams={sp} />
      <form className="ma-form" action={saveEvent} encType="multipart/form-data">
        <input type="hidden" name="id" value={e.id} />
        <section className="ma-card">
          <label>Title<input name="title" defaultValue={e.title} required /></label>
          <div className="row"><label>Date<input name="start_date" type="date" defaultValue={datePart(e.starts_at)} required /></label><label>Start time<input name="start_time" type="time" defaultValue={e.all_day ? "" : timePart(e.starts_at)} /><span className="hint">Leave blank for an all-day event.</span></label></div>
          <div className="row"><label>End time<input name="end_time" type="time" defaultValue={timePart(e.ends_at)} /></label><label>End date (if different)<input name="end_date" type="date" defaultValue={e.ends_at && datePart(e.ends_at) !== datePart(e.starts_at) ? datePart(e.ends_at) : ""} /></label></div>
          <label>Location<input name="location" defaultValue={e.location ?? ""} /></label>
          <label>Description<textarea name="description" rows={4} defaultValue={e.description ?? ""} /></label>
          {publicMediaUrl(e.image_path) && <img src={publicMediaUrl(e.image_path)!} alt="" style={{ maxWidth: 320, borderRadius: 10 }} />}
          <label>Picture or flyer<PhotoInput name="image" /></label>
          <div className="row">
            <label className="check"><input type="checkbox" name="rsvp_enabled" defaultChecked={e.rsvp_enabled} /> Allow RSVP</label>
            <label className="check"><input type="checkbox" name="show_on_website" defaultChecked={e.show_on_website} /> Show on church website</label>
          </div>
          <p className="hint">Uncheck for members-only gatherings, like something at a member&rsquo;s home.</p>
          <label>Status<select name="status" defaultValue={e.status}><option value="approved">Approved (on the calendar)</option><option value="draft">Draft</option><option value="suggested">Suggested</option><option value="archived">Archived</option></select></label>
        </section>
        <div className="ma-actions"><button className="button navy" type="submit">Save</button>{e.status !== "approved" && <button className="button gold" type="submit" name="approve" value="1">Save and approve</button>}</div>
      </form>
      {!isNew && (e.event_rsvps as { headcount: number; people: { first_name: string; last_name: string } | null }[]).length > 0 && (
        <section className="ma-card" style={{ marginTop: 16 }}><h2>RSVPs</h2>{(e.event_rsvps as { headcount: number; people: { first_name: string; last_name: string } | null }[]).map((r, i) => <p key={i} style={{ margin: "0 0 4px" }}>{r.people ? `${r.people.first_name} ${r.people.last_name}` : "Member"} · {r.headcount}</p>)}</section>
      )}
      {!isNew && <form action={deleteEvent} style={{ marginTop: 30 }}><input type="hidden" name="id" value={e.id} /><button className="button small danger" type="submit">Delete event</button></form>}
    </>
  );
}
