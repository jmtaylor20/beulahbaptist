import Link from "next/link";
import { base, fullName, photoUrls, requireMember, type Household, type Person } from "../../../../lib/members";
import { supabaseServer } from "../../../../lib/supabase/server";
import { TRANSLATIONS } from "../../../../lib/devotion";
import { Avatar, Notice } from "../../ui";
import { addFamilyMember, removeFamilyMember, updateFamilyMember, updateProfile } from "../actions";

export const metadata = { title: "Your family" };

function Vis({ name, value, label, children }: { name: string; value: string; label: string; children: React.ReactNode }) {
  return (
    <div className="vis">
      <label>{label}{children}</label>
      <label>Who sees it<select name={name} defaultValue={value}><option value="church">Church office only</option><option value="members">Members</option></select></label>
    </div>
  );
}

// The fields a family member can have. Used for both editing and adding.
function MemberFields({ m, last }: { m?: Person; last: string }) {
  return (
    <>
      <div className="row">
        <label>First name<input name="first_name" defaultValue={m?.first_name ?? ""} required /></label>
        <label>Last name<input name="last_name" defaultValue={m?.last_name ?? last} /></label>
      </div>
      <label>Who they are<select name="role" defaultValue={m?.role ?? "spouse"}><option value="spouse">Spouse</option><option value="child">Child</option><option value="other">Other family member</option></select><span className="hint">Children are listed with the family only and never shown outside the church.</span></label>
      <Vis name="show_phone" value={m?.show_phone ?? "church"} label="Mobile phone"><input name="phone" type="tel" defaultValue={m?.phone ?? ""} /></Vis>
      <Vis name="show_email" value={m?.show_email ?? "church"} label="Email"><input name="email" type="email" defaultValue={m?.email ?? ""} /></Vis>
      <Vis name="show_birthday" value={m?.show_birthday ?? "church"} label="Birthday"><input name="birthday" type="date" defaultValue={m?.birthday ?? ""} /></Vis>
      <label>Photo<input name="photo" type="file" accept="image/*" /></label>
      <label>A little about them<textarea name="bio" rows={2} defaultValue={m?.bio ?? ""} /></label>
    </>
  );
}

export default async function Profile({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const person = await requireMember();
  const b = await base();
  const supabase = await supabaseServer();
  const [{ data: household }, { data: familyRows }, { data: otherLogins }] = await Promise.all([
    person.household_id ? supabase.from("households").select("*").eq("id", person.household_id).maybeSingle() : Promise.resolve({ data: null }),
    person.household_id ? supabase.from("people").select("*").eq("household_id", person.household_id).is("auth_user_id", null).order("created_at") : Promise.resolve({ data: [] }),
    person.household_id ? supabase.from("directory").select("id,first_name,last_name,role,photo_path").eq("household_id", person.household_id).neq("id", person.id) : Promise.resolve({ data: [] }),
  ]);
  const h = household as Household | null;
  const family = (familyRows ?? []) as Person[];
  const withLogin = ((otherLogins ?? []) as { id: string; first_name: string; last_name: string; role: string; photo_path: string | null }[]).filter((o) => !family.some((m) => m.id === o.id));
  const photos = await photoUrls([person.photo_path, h?.photo_path, ...family.map((m) => m.photo_path), ...withLogin.map((o) => o.photo_path)]);
  const sp = await searchParams;
  const emails = [person.email, ...family.map((m) => m.email)].filter(Boolean).length;

  return (
    <>
      <h1>Your family</h1>
      <p className="ma-lead">One login for your whole household. The church office keeps the full record; you choose what other members can see about each of you.</p>
      <Notice searchParams={sp} />

      <form className="ma-form" action={updateProfile} encType="multipart/form-data">
        <section className="ma-card">
          <h2>{h ? h.name : "Household"}</h2>
          {h ? (
            <>
              <label>Family name in the directory<input name="household_name" defaultValue={h.name} required /></label>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <Avatar name={h.name} src={photos.get(h.photo_path ?? "") ?? null} />
                <label style={{ flex: 1 }}>Family photo<input name="household_photo" type="file" accept="image/*" /></label>
              </div>
              <Vis name="show_address" value={person.show_address} label="Street address"><input name="address" defaultValue={h.address ?? ""} /></Vis>
              <div className="row"><label>City<input name="city" defaultValue={h.city ?? ""} /></label><label>ZIP<input name="zip" defaultValue={h.zip ?? ""} /></label></div>
              <input type="hidden" name="state" value={h.state ?? "AL"} />
              <div className="row"><label>Home phone<input name="home_phone" type="tel" defaultValue={h.home_phone ?? ""} /></label><label>Anniversary<input name="anniversary" type="date" defaultValue={h.anniversary ?? ""} /></label></div>
            </>
          ) : <p className="hint">The church office will set up your household.</p>}
        </section>

        <section className="ma-card">
          <h2>You</h2>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
            <Avatar name={fullName(person)} src={photos.get(person.photo_path ?? "") ?? null} size="lg" />
            <label style={{ flex: 1 }}>Your photo<input name="photo" type="file" accept="image/*" capture="user" /></label>
          </div>
          <div className="row">
            <label>First name<input name="first_name" defaultValue={person.first_name} required /></label>
            <label>Last name<input name="last_name" defaultValue={person.last_name} required /></label>
          </div>
          <Vis name="show_phone" value={person.show_phone} label="Mobile phone"><input name="phone" type="tel" defaultValue={person.phone ?? ""} /></Vis>
          <Vis name="show_email" value={person.show_email} label="Email"><input name="email" type="email" defaultValue={person.email ?? ""} /></Vis>
          <Vis name="show_birthday" value={person.show_birthday} label="Birthday"><input name="birthday" type="date" defaultValue={person.birthday ?? ""} /></Vis>
          <label>A little about you<textarea name="bio" rows={3} defaultValue={person.bio ?? ""} placeholder="Sunday school class, where you work, what you love about Beulah" /></label>
          <label>Bible translation for daily reading<select name="bible_translation" defaultValue={person.bible_translation}>{Object.entries(TRANSLATIONS).map(([k, t]) => <option key={k} value={k}>{t.name} ({k})</option>)}</select></label>
        </section>
        <div className="ma-actions">
          <button className="button navy" type="submit">Save</button>
          <Link className="button quiet" href={`${b}/profile/password`}>Change password</Link>
        </div>
      </form>

      <h2 style={{ marginTop: 30 }}>Family members</h2>
      <p className="ma-lead">Each person can have their own email and phone. {emails === 1 ? "Right now the weekly email goes to one address." : `The weekly email goes to all ${emails} addresses on file.`}</p>
      {withLogin.map((o) => (
        <div key={o.id} className="ma-card flat" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={`${o.first_name} ${o.last_name}`} src={photos.get(o.photo_path ?? "") ?? null} size="sm" />
          <span><strong style={{ color: "var(--navy)" }}>{o.first_name} {o.last_name}</strong> <span className="ma-badge blue">own login</span><br /><small style={{ color: "var(--muted)" }}>Edits their own details from their login.</small></span>
        </div>
      ))}
      {family.map((m) => (
        <details key={m.id} className="ma-card">
          <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={fullName(m)} src={photos.get(m.photo_path ?? "") ?? null} size="sm" />
            <span><strong style={{ color: "var(--navy)" }}>{fullName(m)}</strong> <span className="ma-badge">{m.role}</span><br /><small style={{ color: "var(--muted)" }}>{[m.email, m.phone].filter(Boolean).join(" · ") || "No contact info yet"}</small></span>
          </summary>
          <form className="ma-form" action={updateFamilyMember} encType="multipart/form-data" style={{ marginTop: 14 }}>
            <input type="hidden" name="id" value={m.id} />
            <MemberFields m={m} last={person.last_name} />
            <div className="ma-actions"><button className="button small navy" type="submit">Save {m.first_name}</button></div>
          </form>
          <form action={removeFamilyMember} style={{ marginTop: 10 }}><input type="hidden" name="id" value={m.id} /><button className="button small quiet" type="submit">Remove {m.first_name} from the family</button></form>
        </details>
      ))}
      {h && (
        <details className="ma-card" open={family.length === 0}>
          <summary style={{ cursor: "pointer", fontWeight: 800, color: "var(--navy)" }}>+ Add a family member</summary>
          <form className="ma-form" action={addFamilyMember} encType="multipart/form-data" style={{ marginTop: 14 }}>
            <MemberFields last={person.last_name} />
            <div className="ma-actions"><button className="button small gold" type="submit">Add to family</button></div>
          </form>
        </details>
      )}
    </>
  );
}
