import Link from "next/link";
import { base, fullName, photoUrl, requireMember, type Household } from "../../../../lib/members";
import { supabaseServer } from "../../../../lib/supabase/server";
import { TRANSLATIONS } from "../../../../lib/devotion";
import { Avatar, Notice } from "../../ui";
import { updateProfile } from "../actions";

export const metadata = { title: "Your profile" };

function Vis({ name, value, label, children }: { name: string; value: string; label: string; children: React.ReactNode }) {
  return (
    <div className="vis">
      <label>{label}{children}</label>
      <label>Who sees it<select name={name} defaultValue={value}><option value="church">Church office only</option><option value="members">Members</option></select></label>
    </div>
  );
}

export default async function Profile({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const person = await requireMember();
  const b = await base();
  const supabase = await supabaseServer();
  const { data: household } = person.household_id ? await supabase.from("households").select("*").eq("id", person.household_id).maybeSingle() : { data: null };
  const h = household as Household | null;
  const photo = await photoUrl(person.photo_path);
  const sp = await searchParams;

  return (
    <>
      <h1>Your profile</h1>
      <p className="ma-lead">The church office keeps your full record. You choose what other members can see.</p>
      <Notice searchParams={sp} />
      <form className="ma-form" action={updateProfile} encType="multipart/form-data">
        <section className="ma-card">
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
            <Avatar name={fullName(person)} src={photo} size="lg" />
            <label style={{ flex: 1 }}>Your photo<input name="photo" type="file" accept="image/*" capture="user" /><span className="hint">Shown to members in the directory.</span></label>
          </div>
          <div className="row">
            <label>First name<input name="first_name" defaultValue={person.first_name} required /></label>
            <label>Last name<input name="last_name" defaultValue={person.last_name} required /></label>
          </div>
          <Vis name="show_phone" value={person.show_phone} label="Mobile phone"><input name="phone" type="tel" defaultValue={person.phone ?? ""} /></Vis>
          <Vis name="show_email" value={person.show_email} label="Email"><input name="email" type="email" defaultValue={person.email ?? ""} /></Vis>
          <Vis name="show_birthday" value={person.show_birthday} label="Birthday"><input name="birthday" type="date" defaultValue={person.birthday ?? ""} /></Vis>
          <label>A little about you<textarea name="bio" rows={3} defaultValue={person.bio ?? ""} placeholder="Sunday school class, where you work, what you love about Beulah" /></label>
        </section>

        <section className="ma-card">
          <h2>{h ? h.name : "Household"}</h2>
          {h ? (
            <>
              <label>Family photo<input name="household_photo" type="file" accept="image/*" /></label>
              <Vis name="show_address" value={person.show_address} label="Street address"><input name="address" defaultValue={h.address ?? ""} /></Vis>
              <div className="row">
                <label>City<input name="city" defaultValue={h.city ?? ""} /></label>
                <label>ZIP<input name="zip" defaultValue={h.zip ?? ""} /></label>
              </div>
              <input type="hidden" name="state" value={h.state ?? "AL"} />
              <div className="row">
                <label>Home phone<input name="home_phone" type="tel" defaultValue={h.home_phone ?? ""} /></label>
                <label>Anniversary<input name="anniversary" type="date" defaultValue={h.anniversary ?? ""} /></label>
              </div>
              <p className="hint">To add or change family members, contact the church office.</p>
            </>
          ) : <p className="hint">The church office will attach you to your family&rsquo;s household.</p>}
        </section>

        <section className="ma-card">
          <h2>Daily reading</h2>
          <label>Bible translation<select name="bible_translation" defaultValue={person.bible_translation}>{Object.entries(TRANSLATIONS).map(([k, t]) => <option key={k} value={k}>{t.name} ({k})</option>)}</select></label>
        </section>

        <div className="ma-actions">
          <button className="button navy" type="submit">Save profile</button>
          <Link className="button quiet" href={`${b}/profile/password`}>Change password</Link>
        </div>
      </form>
    </>
  );
}
