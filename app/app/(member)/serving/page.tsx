import { fmtDate, publicMediaUrl, requireMember } from "../../../../lib/members";
import { supabaseServer } from "../../../../lib/supabase/server";
import { Empty, Notice } from "../../ui";
import { suggestAnnouncement, toggleServing } from "../actions";

export const metadata = { title: "Serving" };

export default async function Serving({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireMember();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data }, { data: names }] = await Promise.all([
    supabase.from("announcements").select("id,title,body,image_path,starts_on,ends_on,slots,status,serving_signups(person_id,note)").eq("kind", "serving").or(`ends_on.is.null,ends_on.gte.${today}`).order("starts_on", { ascending: true, nullsFirst: false }),
    supabase.from("directory").select("id,first_name,last_name"),
  ]);
  const who = new Map((names ?? []).map((n) => [n.id, `${n.first_name} ${n.last_name}`]));

  return (
    <>
      <h1>Serving</h1>
      <p className="ma-lead">Where a hand is needed. Tap to sign up, tap again to step back.</p>
      <Notice searchParams={sp} />
      {!data?.length ? <Empty>No sign-ups open right now.</Empty> : data.map((s) => {
        const signups = (s.serving_signups as { person_id: string; note: string | null }[] | null) ?? [];
        const signed = signups.some((x) => x.person_id === me.id);
        const full = !!s.slots && signups.length >= s.slots && !signed;
        return (
          <article key={s.id} className="ma-card ma-announcement">
            {publicMediaUrl(s.image_path) && <img src={publicMediaUrl(s.image_path)!} alt="" />}
            <h3>{s.title} {s.status === "suggested" && <span className="ma-badge gold">awaiting approval</span>}</h3>
            {s.body && <p>{s.body}</p>}
            <div className="meta">{s.starts_on ? fmtDate(s.starts_on) : ""}{s.slots ? ` · ${signups.length} of ${s.slots} filled` : ` · ${signups.length} signed up`}</div>
            {signups.length > 0 && <p className="meta" style={{ marginTop: 6 }}>{signups.map((x) => who.get(x.person_id) ?? "A member").join(", ")}</p>}
            {s.status === "approved" && (
              <form action={toggleServing} className="ma-actions"><input type="hidden" name="announcement_id" value={s.id} />
                <button className={`button small ${signed ? "quiet" : "navy"}`} type="submit" disabled={full}>{signed ? "Step back" : full ? "Full" : "🙌 Sign me up"}</button>
              </form>
            )}
          </article>
        );
      })}

      <details className="ma-card" style={{ marginTop: 20 }} open={!!sp.error}>
        <summary style={{ cursor: "pointer", fontWeight: 800, color: "var(--navy)" }}>Suggest a serving need</summary>
        <form className="ma-form" action={suggestAnnouncement} encType="multipart/form-data" style={{ marginTop: 14 }}>
          <input type="hidden" name="kind" value="serving" />
          <label>What is needed<input name="title" required placeholder="Nursery helpers for Sunday morning" /></label>
          <label>Details<textarea name="body" rows={3} /></label>
          <div className="row"><label>Date<input name="starts_on" type="date" /></label><label>How many people<input name="slots" type="number" min={1} /></label></div>
          <label>Picture<input name="image" type="file" accept="image/*" /></label>
          <button className="button gold" type="submit">{me.is_admin ? "Post sign-up" : "Send suggestion"}</button>
        </form>
      </details>
    </>
  );
}
