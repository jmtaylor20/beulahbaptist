import Link from "next/link";
import { notFound } from "next/navigation";
import { base, monthDay, photoUrls, requireMember } from "../../../../../lib/members";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { Avatar, ContactButtons } from "../../../ui";
import { Lightbox } from "../../../Lightbox";

export const metadata = { title: "Household" };

export default async function HouseholdPage({ params }: { params: Promise<{ householdId: string }> }) {
  await requireMember();
  const b = await base();
  const { householdId } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("directory").select("*").eq("household_id", householdId).order("role").order("birthday");
  if (!data?.length) notFound();
  const head = data[0];
  const photos = await photoUrls([head.household_photo_path, ...data.map((p) => p.photo_path)]);
  const order = { head: 0, spouse: 1, child: 2, other: 3 } as Record<string, number>;
  const members = [...data].sort((a, c) => order[a.role] - order[c.role]);
  const adults = members.filter((m) => !m.is_minor);
  const addr = head.address ? [head.address, [head.city, head.state].filter(Boolean).join(", "), head.zip].filter(Boolean).join(" · ") : null;
  const mapHref = addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${head.address} ${head.city ?? ""} ${head.state ?? ""} ${head.zip ?? ""}`)}` : null;
  const groupText = adults.map((m) => m.phone?.replace(/[^\d+]/g, "")).filter(Boolean);
  const groupMail = adults.map((m) => m.email).filter(Boolean);

  return (
    <>
      <Link className="text-link" href={`${b}/directory`}><span>←</span> Directory</Link>
      <section className="ma-card" style={{ marginTop: 16, textAlign: "center" }}>
        <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
          <Lightbox name={head.household_name ?? ""} src={photos.get(head.household_photo_path ?? "") ?? null}><Avatar name={head.household_name ?? ""} src={photos.get(head.household_photo_path ?? "") ?? photos.get(adults[0]?.photo_path ?? "") ?? null} size="lg" /></Lightbox>
          <h1 style={{ marginBottom: 0 }}>{head.household_name}</h1>
          {addr && <p className="ma-lead" style={{ marginBottom: 0 }}>{addr}</p>}
          {head.anniversary && <span className="ma-badge gold">💍 Anniversary {monthDay(head.anniversary)}</span>}
        </div>
        <div className="ma-contact" style={{ justifyContent: "center" }}>
          {mapHref && <a href={mapHref} target="_blank" rel="noreferrer">📍 Directions</a>}
          {groupText.length > 1 && <a className="light" href={`sms:${groupText.join(",")}`}>💬 Text the family</a>}
          {groupMail.length > 1 && <a className="light" href={`mailto:${groupMail.join(",")}`}>✉️ Email the family</a>}
        </div>
      </section>

      <div className="ma-household-members">
        {members.map((m) => (
          <div key={m.id} className="ma-member">
            <Lightbox name={`${m.first_name} ${m.last_name}`} src={photos.get(m.photo_path ?? "") ?? null}><Avatar name={`${m.first_name} ${m.last_name}`} src={photos.get(m.photo_path ?? "") ?? null} /></Lightbox>
            <div>
              <strong>{m.first_name} {m.last_name}</strong> {m.is_minor && <span className="ma-badge">child</span>}
              {m.birthday && <p>🎂 {monthDay(m.birthday)}</p>}
              {!m.is_minor && <ContactButtons phone={m.phone} email={m.email} />}
            </div>
          </div>
        ))}
      </div>
      <p className="ma-disclaimer">Children are listed with their family only and are never shown outside the church directory.</p>
    </>
  );
}
