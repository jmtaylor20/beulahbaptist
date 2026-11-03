import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { base, monthDay, photoUrl, requireMember } from "../../../../../../lib/members";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { Avatar, ContactButtons } from "../../../../ui";

// A member who is not attached to a household yet.
export default async function PersonPage({ params }: { params: Promise<{ personId: string }> }) {
  await requireMember();
  const b = await base();
  const { personId } = await params;
  const supabase = await supabaseServer();
  const { data: m } = await supabase.from("directory").select("*").eq("id", personId).maybeSingle();
  if (!m) notFound();
  if (m.household_id) redirect(`${b}/directory/${m.household_id}`);
  return (
    <>
      <Link className="text-link" href={`${b}/directory`}><span>←</span> Directory</Link>
      <section className="ma-card" style={{ marginTop: 16, textAlign: "center" }}>
        <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
          <Avatar name={`${m.first_name} ${m.last_name}`} src={await photoUrl(m.photo_path)} size="lg" />
          <h1 style={{ marginBottom: 0 }}>{m.first_name} {m.last_name}</h1>
          {m.birthday && <p className="ma-lead" style={{ marginBottom: 0 }}>🎂 {monthDay(m.birthday)}</p>}
          {m.bio && <p>{m.bio}</p>}
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}><ContactButtons phone={m.phone} email={m.email} /></div>
      </section>
    </>
  );
}
