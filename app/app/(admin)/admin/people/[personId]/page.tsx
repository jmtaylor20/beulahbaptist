import Link from "next/link";
import { notFound } from "next/navigation";
import { base, fmtDate, fullName, photoUrl, requireAdmin, type Person } from "../../../../../../lib/members";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { Avatar, Notice } from "../../../../ui";
import { deletePerson, savePerson, setStatus } from "../../actions";
import { PhotoInput } from "../../../../PhotoInput";

export const metadata = { title: "Person" };

export default async function PersonAdmin({ params, searchParams }: { params: Promise<{ personId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const b = await base();
  const { personId } = await params;
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const isNew = personId === "new";
  const { data } = isNew ? { data: null } : await supabase.from("people").select("*").eq("id", personId).maybeSingle();
  if (!isNew && !data) notFound();
  const p = (data ?? { id: "", first_name: "", last_name: "", role: "other", status: "active", show_email: "church", show_phone: "church", show_birthday: "church", show_address: "church", bible_translation: "KJV", is_admin: false, is_minor: false }) as Person;
  const { data: households } = await supabase.from("households").select("id,name").order("name");
  const photo = await photoUrl(p.photo_path);

  return (
    <>
      <Link className="text-link" href={`${b}/admin/people`}><span>←</span> People</Link>
      <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "16px 0" }}>
        {!isNew && <Avatar name={fullName(p)} src={photo} size="lg" />}
        <div><h1 style={{ marginBottom: 4 }}>{isNew ? "Add person" : fullName(p)}</h1>{!isNew && <span className={`ma-badge ${p.status === "pending" ? "gold" : p.status === "active" ? "green" : "red"}`}>{p.status}</span>} {!isNew && p.request_note && <p className="ma-lead" style={{ marginTop: 8 }}>&ldquo;{p.request_note}&rdquo;</p>}</div>
      </div>
      <Notice searchParams={sp} />

      {p.status === "pending" && (
        <section className="ma-card navy">
          <h2>Access request · {fmtDate(p.created_at)}</h2>
          <p>Approve {p.first_name} and they get an email saying the family login is ready. Their household was created at signup; they add spouse and children themselves from their profile.</p>
          <div className="ma-actions">
            <form action={setStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="active" /><button className="button gold" type="submit">Approve</button></form>
            <form action={setStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="declined" /><button className="button ghost" type="submit">Decline</button></form>
          </div>
        </section>
      )}

      <form className="ma-form" action={savePerson} encType="multipart/form-data">
        <input type="hidden" name="id" value={p.id} />
        <section className="ma-card">
          <div className="row"><label>First name<input name="first_name" defaultValue={p.first_name} required /></label><label>Last name<input name="last_name" defaultValue={p.last_name} required /></label></div>
          <div className="row">
            <label>Household<select name="household_id" defaultValue={p.household_id ?? ""}><option value="">None yet</option>{(households ?? []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
            <label>Role in household<select name="role" defaultValue={p.role}><option value="head">Head</option><option value="spouse">Spouse</option><option value="child">Child</option><option value="other">Other</option></select></label>
          </div>
          <div className="row"><label>Email<input name="email" type="email" defaultValue={p.email ?? ""} /></label><label>Phone<input name="phone" type="tel" defaultValue={p.phone ?? ""} /></label></div>
          <div className="row"><label>Birthday<input name="birthday" type="date" defaultValue={p.birthday ?? ""} /></label><label>Photo<PhotoInput name="photo" /></label></div>
          <label>Bio (shown to members)<textarea name="bio" rows={2} defaultValue={p.bio ?? ""} /></label>
          <label>Office notes (never shown to members)<textarea name="admin_notes" rows={3} defaultValue={p.admin_notes ?? ""} /></label>
          <div className="row">
            <label className="check"><input type="checkbox" name="is_minor" defaultChecked={p.is_minor} /> Child (listed with family only)</label>
            <label className="check"><input type="checkbox" name="is_admin" defaultChecked={p.is_admin} /> Church admin</label>
          </div>
          <label>Status<select name="status" defaultValue={p.status}><option value="pending">Pending</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="declined">Declined</option></select></label>
          <div className="row">
            <label>Email visible to<select name="show_email" defaultValue={p.show_email}><option value="church">Church office</option><option value="members">Members</option></select></label>
            <label>Phone visible to<select name="show_phone" defaultValue={p.show_phone}><option value="church">Church office</option><option value="members">Members</option></select></label>
          </div>
          <div className="row">
            <label>Birthday visible to<select name="show_birthday" defaultValue={p.show_birthday}><option value="church">Church office</option><option value="members">Members</option></select></label>
            <label>Address visible to<select name="show_address" defaultValue={p.show_address}><option value="church">Church office</option><option value="members">Members</option></select></label>
          </div>
        </section>
        <div className="ma-actions"><button className="button navy" type="submit">Save</button></div>
      </form>
      {!isNew && <form action={deletePerson} style={{ marginTop: 30 }}><input type="hidden" name="id" value={p.id} /><button className="button small danger" type="submit">Delete this person</button></form>}
    </>
  );
}
