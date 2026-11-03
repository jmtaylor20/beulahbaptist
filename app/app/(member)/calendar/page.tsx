import { fmtDate, fmtTime, publicMediaUrl, requireMember } from "../../../../lib/members";
import { supabaseServer } from "../../../../lib/supabase/server";
import { Empty, Notice } from "../../ui";
import { rsvp, suggestEvent } from "../actions";

export const metadata = { title: "Calendar" };

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export default async function Calendar({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireMember();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const [{ data: events }, { data: rsvps }] = await Promise.all([
    supabase.from("events").select("id,title,description,location,starts_at,ends_at,all_day,image_path,rsvp_enabled,status,event_rsvps(headcount)").gte("starts_at", since.toISOString()).order("starts_at").limit(200),
    supabase.from("event_rsvps").select("event_id,headcount").eq("person_id", me.id),
  ]);
  const mine = new Map((rsvps ?? []).map((r) => [r.event_id, r.headcount]));
  let lastMonth = "";

  return (
    <>
      <h1>Calendar</h1>
      <Notice searchParams={sp} />
      {!events?.length ? <Empty>Nothing scheduled yet.</Empty> : events.map((e) => {
        const month = fmtDate(e.starts_at, { month: "long", year: "numeric" });
        const header = month !== lastMonth ? <p className="ma-month">{month}</p> : null; lastMonth = month;
        const going = (e.event_rsvps as { headcount: number }[] | null)?.reduce((s, r) => s + r.headcount, 0) ?? 0;
        const ics = `data:text/calendar;charset=utf8,${encodeURIComponent(`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Beulah Baptist Church//EN\nBEGIN:VEVENT\nUID:${e.id}@beulahbaptistchurch.com\nDTSTAMP:${icsDate(new Date().toISOString())}\nDTSTART:${icsDate(e.starts_at)}\nDTEND:${icsDate(e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 3600000).toISOString())}\nSUMMARY:${e.title}\nLOCATION:${e.location ?? ""}\nDESCRIPTION:${(e.description ?? "").replace(/\n/g, "\\n")}\nEND:VEVENT\nEND:VCALENDAR`)}`;
        return (
          <div key={e.id}>
            {header}
            <article id={`event-${e.id}`} className="ma-card">
              <div className="ma-event">
                <div className="date"><small>{fmtDate(e.starts_at, { weekday: "short" })}</small><b>{fmtDate(e.starts_at, { day: "numeric" })}</b></div>
                <div>
                  <h3 style={{ marginBottom: 2 }}>{e.title} {e.status === "suggested" && <span className="ma-badge gold">awaiting approval</span>}</h3>
                  <div className="meta">{e.all_day ? "All day" : `${fmtTime(e.starts_at)}${e.ends_at ? ` to ${fmtTime(e.ends_at)}` : ""}`}{e.location ? ` · ${e.location}` : ""}</div>
                  {publicMediaUrl(e.image_path) && <img src={publicMediaUrl(e.image_path)!} alt="" style={{ borderRadius: 10, marginTop: 10 }} />}
                  {e.description && <p>{e.description}</p>}
                  <div className="ma-contact">
                    <a className="light" href={ics} download={`${e.title.replace(/\W+/g, "-")}.ics`}>📅 Add to calendar</a>
                    {e.rsvp_enabled && (
                      <form action={rsvp} className="ma-inline"><input type="hidden" name="event_id" value={e.id} />
                        <input name="headcount" type="number" min={0} max={20} defaultValue={mine.get(e.id) ?? 1} style={{ width: 64, padding: 8, borderRadius: 8, border: "1px solid var(--line)" }} aria-label="How many coming" />
                        <button className="button small navy" type="submit">{mine.has(e.id) ? "Update RSVP" : "RSVP"}</button>
                        <span className="meta">{going} going</span>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </article>
          </div>
        );
      })}

      <details className="ma-card" style={{ marginTop: 20 }} open={!!sp.error}>
        <summary style={{ cursor: "pointer", fontWeight: 800, color: "var(--navy)" }}>Suggest a calendar date</summary>
        <form className="ma-form" action={suggestEvent} style={{ marginTop: 14 }}>
          <label>What is it<input name="title" required /></label>
          <div className="row"><label>Date<input name="date" type="date" required /></label><label>Time<input name="time" type="time" /><span className="hint">Leave blank for all day.</span></label></div>
          <label>Where<input name="location" /></label>
          <label>Details<textarea name="description" rows={3} /></label>
          <button className="button gold" type="submit">{me.is_admin ? "Add to calendar" : "Send suggestion"}</button>
        </form>
      </details>
    </>
  );
}
