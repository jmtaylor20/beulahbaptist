import Link from "next/link";
import { base, photoUrls, requireMember } from "../../../../lib/members";
import { supabaseServer } from "../../../../lib/supabase/server";
import { Avatar, Empty } from "../../ui";

export const metadata = { title: "Directory" };

type Row = { id: string; household_id: string | null; first_name: string; last_name: string; role: string; is_minor: boolean; photo_path: string | null; household_name: string | null; household_photo_path: string | null; city: string | null };

export default async function Directory({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireMember();
  const b = await base();
  const { q = "" } = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("directory").select("id,household_id,first_name,last_name,role,is_minor,photo_path,household_name,household_photo_path,city").order("last_name").order("first_name");
  const rows = (data ?? []) as Row[];

  // Group by household; people with no household stand alone.
  const groups = new Map<string, { key: string; name: string; photo: string | null; members: Row[] }>();
  for (const r of rows) {
    const key = r.household_id ?? `solo-${r.id}`;
    const g = groups.get(key) ?? { key, name: r.household_name ?? `${r.first_name} ${r.last_name}`, photo: r.household_photo_path, members: [] };
    g.members.push(r);
    groups.set(key, g);
  }
  const needle = q.trim().toLowerCase();
  let list = [...groups.values()].sort((a, c) => a.members[0].last_name.localeCompare(c.members[0].last_name));
  if (needle) list = list.filter((g) => g.name.toLowerCase().includes(needle) || g.members.some((m) => `${m.first_name} ${m.last_name}`.toLowerCase().includes(needle)));
  const photos = await photoUrls(list.flatMap((g) => [g.photo, ...g.members.map((m) => m.photo_path)]));
  const letters = [...new Set(list.map((g) => g.members[0].last_name[0]?.toUpperCase()))];

  return (
    <>
      <h1>Directory</h1>
      <form className="ma-search" method="get"><input name="q" defaultValue={q} placeholder="Search by name" aria-label="Search the directory" /></form>
      {!needle && letters.length > 6 && <div className="ma-alpha">{letters.map((l) => <a key={l} href={`#letter-${l}`}>{l}</a>)}</div>}
      {!list.length ? <Empty>{needle ? "No one matches that search." : "The directory is empty so far."}</Empty> : (
        <div className="ma-list">
          {list.map((g, i) => {
            const letter = g.members[0].last_name[0]?.toUpperCase();
            const first = i === 0 || list[i - 1].members[0].last_name[0]?.toUpperCase() !== letter;
            const adults = g.members.filter((m) => !m.is_minor);
            const kids = g.members.filter((m) => m.is_minor);
            const href = g.key.startsWith("solo-") ? `${b}/directory/person/${g.members[0].id}` : `${b}/directory/${g.key}`;
            const photo = photos.get(g.photo ?? "") ?? photos.get(adults[0]?.photo_path ?? "") ?? null;
            return (
              <Link key={g.key} id={first ? `letter-${letter}` : undefined} href={href} className="ma-row">
                <Avatar name={g.name} src={photo} />
                <div className="ma-row-text">
                  <strong>{g.name}</strong>
                  <small>{adults.map((m) => m.first_name).join(" & ")}{kids.length ? ` · ${kids.length} ${kids.length === 1 ? "child" : "children"}` : ""}{g.members[0].city ? ` · ${g.members[0].city}` : ""}</small>
                </div>
                <span className="ma-chevron">›</span>
              </Link>
            );
          })}
        </div>
      )}
      <p className="ma-disclaimer">Member information is shared only within the Beulah Baptist Church family and is never published publicly. Each member chooses what others can see.</p>
    </>
  );
}
