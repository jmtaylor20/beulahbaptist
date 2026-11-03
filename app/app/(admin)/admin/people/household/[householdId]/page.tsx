import Link from "next/link";
import { notFound } from "next/navigation";
import { base, requireAdmin, type Household, type Person } from "../../../../../../../lib/members";
import { supabaseServer } from "../../../../../../../lib/supabase/server";
import { Notice } from "../../../../../ui";
import { deleteHousehold, saveHousehold } from "../../../actions";
import { PhotoInput } from "../../../../../PhotoInput";

export const metadata = { title: "Household" };

export default async function HouseholdAdmin({ params, searchParams }: { params: Promise<{ householdId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const b = await base();
  const { householdId } = await params;
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const [{ data: h }, { data: members }] = await Promise.all([
    supabase.from("households").select("*").eq("id", householdId).maybeSingle(),
    supabase.from("people").select("id,first_name,last_name,role,is_minor,status").eq("household_id", householdId).order("role"),
  ]);
  if (!h) notFound();
  const hh = h as Household;
  return (
    <>
      <Link className="text-link" href={`${b}/admin/people`}><span>←</span> People</Link>
      <h1 style={{ marginTop: 16 }}>{hh.name}</h1>
      <Notice searchParams={sp} />
      <section className="ma-card">
        <h2>Members</h2>
        {(members as Person[] | null)?.map((m) => <p key={m.id} style={{ margin: "0 0 6px" }}><Link href={`${b}/admin/people/${m.id}`}>{m.first_name} {m.last_name}</Link> <span className="ma-badge">{m.role}</span> {m.is_minor && <span className="ma-badge">child</span>} {m.status !== "active" && <span className="ma-badge red">{m.status}</span>}</p>)}
        <Link className="button small navy" href={`${b}/admin/people/new?household=${hh.id}`}>Add a family member</Link>
      </section>
      <form className="ma-form" action={saveHousehold} encType="multipart/form-data">
        <input type="hidden" name="id" value={hh.id} />
        <section className="ma-card">
          <label>Household name<input name="name" defaultValue={hh.name} required /></label>
          <label>Family photo<PhotoInput name="photo" crop="square" /></label>
          <label>Street address<input name="address" defaultValue={hh.address ?? ""} /></label>
          <div className="row"><label>City<input name="city" defaultValue={hh.city ?? ""} /></label><label>State<input name="state" defaultValue={hh.state ?? "AL"} /></label></div>
          <div className="row"><label>ZIP<input name="zip" defaultValue={hh.zip ?? ""} /></label><label>Home phone<input name="home_phone" type="tel" defaultValue={hh.home_phone ?? ""} /></label></div>
          <label>Anniversary<input name="anniversary" type="date" defaultValue={hh.anniversary ?? ""} /></label>
          <label>Office notes<textarea name="admin_notes" rows={3} defaultValue={hh.admin_notes ?? ""} /></label>
        </section>
        <div className="ma-actions"><button className="button navy" type="submit">Save household</button></div>
      </form>
      <form action={deleteHousehold} style={{ marginTop: 30 }}><input type="hidden" name="id" value={hh.id} /><button className="button small danger" type="submit">Delete household (people are kept)</button></form>
    </>
  );
}
