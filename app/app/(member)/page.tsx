import Link from "next/link";
import { base, fmtDate, fmtTime, monthDay, publicMediaUrl, requireMember } from "../../../lib/members";
import { supabaseServer } from "../../../lib/supabase/server";
import { todaysReading } from "../../../lib/devotion";

export default async function Home() {
  const person = await requireMember();
  const b = await base();
  const supabase = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: announcements }, { data: events }, { data: prayers }, { data: birthdays }] = await Promise.all([
    supabase.from("announcements").select("id,title,body,image_path,kind").eq("status", "approved").or(`ends_on.is.null,ends_on.gte.${today}`).order("created_at", { ascending: false }).limit(3),
    supabase.from("events").select("id,title,starts_at,all_day,location").eq("status", "approved").gte("starts_at", new Date().toISOString()).order("starts_at").limit(4),
    supabase.from("prayer_requests").select("id,body,created_at").eq("audience", "church").is("answered_at", null).order("created_at", { ascending: false }).limit(3),
    supabase.from("directory").select("id,first_name,last_name,birthday").not("birthday", "is", null),
  ]);
  const reading = todaysReading();
  const thisWeek = (birthdays ?? []).filter((p) => {
    const d = new Date(`${p.birthday}T12:00:00`); const now = new Date();
    const next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
    const diff = (next.getTime() - now.getTime()) / 86400000;
    return diff >= -1 && diff <= 7;
  });

  return (
    <>
      <p className="eyebrow">{fmtDate(new Date().toISOString(), { weekday: "long", month: "long", day: "numeric" })}</p>
      <h1>Welcome, {person.first_name}.</h1>

      <div className="ma-grid tiles" style={{ marginBottom: 18 }}>
        <Link className="ma-tile" href={`${b}/directory`}><span>👥</span><strong>Directory</strong><small>Find a church family</small></Link>
        <Link className="ma-tile" href={`${b}/prayer`}><span>🙏</span><strong>Prayer</strong><small>Share and pray</small></Link>
        <Link className="ma-tile" href={`${b}/calendar`}><span>📅</span><strong>Calendar</strong><small>What is coming up</small></Link>
        <Link className="ma-tile" href={`${b}/devotion`}><span>📖</span><strong>Today&rsquo;s reading</strong><small>{reading.label}</small></Link>
      </div>

      {announcements?.length ? (
        <section className="ma-card">
          <p className="eyebrow">Announcements</p>
          {announcements.map((a) => (
            <div key={a.id} className="ma-announcement" style={{ marginBottom: 16 }}>
              {publicMediaUrl(a.image_path) && <img src={publicMediaUrl(a.image_path)!} alt="" />}
              <h3>{a.title}</h3>
              {a.body && <p>{a.body}</p>}
            </div>
          ))}
          <Link className="text-link" href={`${b}/announcements`}>All announcements <span>→</span></Link>
        </section>
      ) : null}

      <div className="ma-grid two">
        <section className="ma-card">
          <p className="eyebrow">Coming up</p>
          {events?.length ? events.map((e) => (
            <div key={e.id} className="ma-event" style={{ marginBottom: 12 }}>
              <div className="date"><small>{fmtDate(e.starts_at, { month: "short" })}</small><b>{fmtDate(e.starts_at, { day: "numeric" })}</b></div>
              <div><strong>{e.title}</strong><p>{e.all_day ? "All day" : fmtTime(e.starts_at)}{e.location ? ` · ${e.location}` : ""}</p></div>
            </div>
          )) : <p className="ma-lead">Nothing on the calendar yet.</p>}
          <Link className="text-link" href={`${b}/calendar`}>Full calendar <span>→</span></Link>
        </section>

        <section className="ma-card">
          <p className="eyebrow">Birthdays this week</p>
          {thisWeek.length ? thisWeek.map((p) => <p key={p.id} style={{ margin: "0 0 6px" }}>🎂 <strong>{p.first_name} {p.last_name}</strong> · {monthDay(p.birthday)}</p>) : <p className="ma-lead">No birthdays this week.</p>}
          <p className="eyebrow" style={{ marginTop: 18 }}>Recent prayer requests</p>
          {prayers?.length ? prayers.map((p) => <p key={p.id} style={{ margin: "0 0 8px", fontSize: ".92rem" }}>{p.body.length > 120 ? `${p.body.slice(0, 120)}…` : p.body}</p>) : <p className="ma-lead">No open requests.</p>}
          <Link className="text-link" href={`${b}/prayer`}>Prayer wall <span>→</span></Link>
        </section>
      </div>
    </>
  );
}
