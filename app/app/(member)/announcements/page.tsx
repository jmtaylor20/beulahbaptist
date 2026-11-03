import { fmtDate, publicMediaUrl, requireMember } from "../../../../lib/members";
import { supabaseServer } from "../../../../lib/supabase/server";
import { Empty, Notice } from "../../ui";
import { suggestAnnouncement } from "../actions";

export const metadata = { title: "Announcements" };

export default async function Announcements({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireMember();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("announcements").select("id,title,body,image_path,link_url,starts_on,ends_on,status,created_at").eq("kind", "announcement").or(`ends_on.is.null,ends_on.gte.${today}`).order("created_at", { ascending: false }).limit(60);

  return (
    <>
      <h1>Announcements</h1>
      <Notice searchParams={sp} />
      {!data?.length ? <Empty>No announcements right now.</Empty> : data.map((a) => (
        <article key={a.id} className="ma-card ma-announcement">
          {publicMediaUrl(a.image_path) && <img src={publicMediaUrl(a.image_path)!} alt="" />}
          <h3>{a.title} {a.status === "suggested" && <span className="ma-badge gold">awaiting approval</span>}</h3>
          {a.body && <p>{a.body}</p>}
          {a.link_url && <a className="text-link" href={a.link_url} target="_blank" rel="noreferrer">Learn more <span>↗</span></a>}
          <div className="meta">{a.starts_on ? fmtDate(a.starts_on) : fmtDate(a.created_at)}{a.ends_on ? ` through ${fmtDate(a.ends_on)}` : ""}</div>
        </article>
      ))}

      <details className="ma-card" style={{ marginTop: 20 }} open={!!sp.error}>
        <summary style={{ cursor: "pointer", fontWeight: 800, color: "var(--navy)" }}>Suggest an announcement</summary>
        <form className="ma-form" action={suggestAnnouncement} encType="multipart/form-data" style={{ marginTop: 14 }}>
          <input type="hidden" name="kind" value="announcement" />
          <label>Title<input name="title" required /></label>
          <label>Details<textarea name="body" rows={4} placeholder="Who, what, when, where" /></label>
          <label>Picture or flyer<input name="image" type="file" accept="image/*" /></label>
          <label>Link<input name="link_url" type="url" placeholder="https://" /></label>
          <div className="row"><label>Show from<input name="starts_on" type="date" /></label><label>Until<input name="ends_on" type="date" /></label></div>
          <button className="button gold" type="submit">{me.is_admin ? "Post announcement" : "Send suggestion"}</button>
          {!me.is_admin && <p className="hint">The church office reviews suggestions before they appear here or in the weekly email.</p>}
        </form>
      </details>
    </>
  );
}
