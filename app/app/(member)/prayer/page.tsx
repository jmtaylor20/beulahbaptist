import { fmtDate, requireMember } from "../../../../lib/members";
import { supabaseServer } from "../../../../lib/supabase/server";
import { Empty, Notice } from "../../ui";
import { addPrayer, deletePrayer, markAnswered, togglePrayed } from "../actions";

export const metadata = { title: "Prayer" };

export default async function Prayer({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; show?: string }> }) {
  const me = await requireMember();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const [{ data: requests }, { data: prayed }, { data: names }] = await Promise.all([
    supabase.from("prayer_requests").select("id,person_id,body,audience,answered_at,answered_note,created_at,prayer_responses(person_id)").order("created_at", { ascending: false }).limit(100),
    supabase.from("prayer_responses").select("prayer_id").eq("person_id", me.id),
    supabase.from("directory").select("id,first_name,last_name"),
  ]);
  const mine = new Set((prayed ?? []).map((p) => p.prayer_id));
  const who = new Map((names ?? []).map((n) => [n.id, `${n.first_name} ${n.last_name}`]));
  const list = (requests ?? []).filter((r) => (sp.show === "answered" ? r.answered_at : !r.answered_at));

  return (
    <>
      <h1>Prayer</h1>
      <p className="ma-lead">&ldquo;Bear ye one another&rsquo;s burdens, and so fulfil the law of Christ.&rdquo; Galatians 6:2</p>
      <Notice searchParams={sp} />

      <details className="ma-card" open={!!sp.error}>
        <summary style={{ cursor: "pointer", fontWeight: 800, color: "var(--navy)" }}>Share a prayer request</summary>
        <form className="ma-form" action={addPrayer} style={{ marginTop: 14 }}>
          <label>Your request<textarea name="body" rows={4} required /></label>
          <label>Share with<select name="audience" defaultValue="church"><option value="church">The whole church</option><option value="pastor">Pastor and staff only</option></select></label>
          <label className="check"><input type="checkbox" name="newsletter_ok" /> It is fine to include this in the weekly email</label>
          <button className="button gold" type="submit">Share request</button>
        </form>
      </details>

      <nav className="ma-tabs"><a href="?" className={sp.show !== "answered" ? "is-active" : ""}>Open</a><a href="?show=answered" className={sp.show === "answered" ? "is-active" : ""}>Answered</a></nav>

      {!list.length ? <Empty>{sp.show === "answered" ? "No answered prayers recorded yet." : "No open requests. Be the first to share one."}</Empty> : (
        <div className="ma-list">
          {list.map((r) => {
            const count = (r.prayer_responses as { person_id: string }[] | null)?.length ?? 0;
            const owner = r.person_id === me.id;
            return (
              <article key={r.id} className={`ma-card ma-prayer ${r.answered_at ? "answered" : ""}`}>
                <div className="who"><span>{owner ? "You" : who.get(r.person_id) ?? "A member"}{r.audience === "pastor" && <span className="ma-badge blue" style={{ marginLeft: 8 }}>pastor only</span>}</span><span>{fmtDate(r.created_at)}</span></div>
                <p>{r.body}</p>
                {r.answered_at && <p className="ma-ok">✅ Answered {fmtDate(r.answered_at)}{r.answered_note ? ` · ${r.answered_note}` : ""}</p>}
                <div className="meta">
                  <form action={togglePrayed}><input type="hidden" name="prayer_id" value={r.id} /><button className={`button small ${mine.has(r.id) ? "navy" : "quiet"}`} type="submit">🙏 {mine.has(r.id) ? "Prayed" : "I prayed"}</button></form>
                  <span>{count} {count === 1 ? "person has" : "people have"} prayed</span>
                  {(owner || me.is_admin) && !r.answered_at && <form action={markAnswered}><input type="hidden" name="prayer_id" value={r.id} /><button className="button small quiet" type="submit">Mark answered</button></form>}
                  {(owner || me.is_admin) && <form action={deletePrayer}><input type="hidden" name="prayer_id" value={r.id} /><button className="button small quiet" type="submit">Remove</button></form>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
