"use server";
import { redirect } from "next/navigation";
import { base, centralToIso, requireMember } from "../../../lib/members";
import { supabaseServer } from "../../../lib/supabase/server";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const opt = (form: FormData, key: string) => text(form, key) || null;
const vis = (form: FormData, key: string) => (text(form, key) === "members" ? "members" : "church");
const bounce = (path: string, params: Record<string, string>) => redirect(`${path}?${new URLSearchParams(params)}`);

async function upload(bucket: "member-photos" | "public-media", folder: string, file: File | null) {
  if (!file || !file.size) return null;
  if (file.size > 8 * 1024 * 1024) throw new Error("Photos need to be under 8 MB.");
  const supabase = await supabaseServer();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

// ---- Profile -------------------------------------------------------------

export async function updateProfile(form: FormData) {
  const person = await requireMember();
  const b = await base();
  const supabase = await supabaseServer();
  try {
    const photo_path = (await upload("member-photos", person.id, form.get("photo") as File | null)) ?? person.photo_path;
    const { error } = await supabase.from("people").update({
      first_name: text(form, "first_name") || person.first_name, last_name: text(form, "last_name") || person.last_name,
      email: opt(form, "email"), phone: opt(form, "phone"), birthday: opt(form, "birthday"), bio: opt(form, "bio"), photo_path,
      show_email: vis(form, "show_email"), show_phone: vis(form, "show_phone"), show_birthday: vis(form, "show_birthday"), show_address: vis(form, "show_address"),
      bible_translation: text(form, "bible_translation") || person.bible_translation,
    }).eq("id", person.id);
    if (error) throw new Error(error.message);
    if (person.household_id && (form.has("address") || form.has("household_photo"))) {
      const { data: h } = await supabase.from("households").select("photo_path").eq("id", person.household_id).maybeSingle();
      const hp = (await upload("member-photos", `${person.id}/household`, form.get("household_photo") as File | null)) ?? h?.photo_path ?? null;
      await supabase.from("households").update({ address: opt(form, "address"), city: opt(form, "city"), state: opt(form, "state") ?? "AL", zip: opt(form, "zip"), home_phone: opt(form, "home_phone"), anniversary: opt(form, "anniversary"), photo_path: hp }).eq("id", person.household_id);
    }
  } catch (e) {
    bounce(`${b}/profile`, { error: (e as Error).message });
  }
  bounce(`${b}/profile`, { ok: "Profile saved." });
}

// ---- Prayer --------------------------------------------------------------

export async function addPrayer(form: FormData) {
  const person = await requireMember();
  const b = await base();
  const body = text(form, "body");
  if (!body) bounce(`${b}/prayer`, { error: "Write your request first." });
  const supabase = await supabaseServer();
  await supabase.from("prayer_requests").insert({ person_id: person.id, body, audience: text(form, "audience") === "pastor" ? "pastor" : "church", newsletter_ok: form.get("newsletter_ok") === "on" });
  bounce(`${b}/prayer`, { ok: text(form, "audience") === "pastor" ? "Sent to the pastor." : "Your request is on the prayer wall." });
}

export async function togglePrayed(form: FormData) {
  const person = await requireMember();
  const b = await base();
  const supabase = await supabaseServer();
  const prayer_id = text(form, "prayer_id");
  const { data } = await supabase.from("prayer_responses").select("prayer_id").eq("prayer_id", prayer_id).eq("person_id", person.id).maybeSingle();
  if (data) await supabase.from("prayer_responses").delete().eq("prayer_id", prayer_id).eq("person_id", person.id);
  else await supabase.from("prayer_responses").insert({ prayer_id, person_id: person.id });
  redirect(`${b}/prayer`);
}

export async function markAnswered(form: FormData) {
  await requireMember();
  const b = await base();
  const supabase = await supabaseServer();
  await supabase.from("prayer_requests").update({ answered_at: new Date().toISOString(), answered_note: opt(form, "note") }).eq("id", text(form, "prayer_id"));
  bounce(`${b}/prayer`, { ok: "Praise God. Marked as answered." });
}

export async function deletePrayer(form: FormData) {
  await requireMember();
  const b = await base();
  const supabase = await supabaseServer();
  await supabase.from("prayer_requests").delete().eq("id", text(form, "prayer_id"));
  redirect(`${b}/prayer`);
}

// ---- Calendar ------------------------------------------------------------

export async function rsvp(form: FormData) {
  const person = await requireMember();
  const b = await base();
  const supabase = await supabaseServer();
  const event_id = text(form, "event_id");
  const headcount = Math.max(0, Number(text(form, "headcount") || 1));
  if (headcount === 0) await supabase.from("event_rsvps").delete().eq("event_id", event_id).eq("person_id", person.id);
  else await supabase.from("event_rsvps").upsert({ event_id, person_id: person.id, headcount });
  redirect(`${b}/calendar#event-${event_id}`);
}

export async function suggestEvent(form: FormData) {
  const person = await requireMember();
  const b = await base();
  const supabase = await supabaseServer();
  const date = text(form, "date"), time = text(form, "time");
  if (!text(form, "title") || !date) bounce(`${b}/calendar`, { error: "A title and date are needed." });
  await supabase.from("events").insert({
    title: text(form, "title"), description: opt(form, "description"), location: opt(form, "location"),
    starts_at: centralToIso(`${date}T${time || "12:00"}`), all_day: !time, status: person.is_admin ? "approved" : "suggested", submitted_by: person.id,
  });
  bounce(`${b}/calendar`, { ok: person.is_admin ? "Event added." : "Thanks. The church office will review your suggestion." });
}

// ---- Announcements and serving ------------------------------------------

export async function suggestAnnouncement(form: FormData) {
  const person = await requireMember();
  const b = await base();
  const supabase = await supabaseServer();
  const kind = text(form, "kind") === "serving" ? "serving" : "announcement";
  const back = `${b}/${kind === "serving" ? "serving" : "announcements"}`;
  if (!text(form, "title")) bounce(back, { error: "Give it a title." });
  try {
    const image_path = await upload("public-media", `announcements/${person.id}`, form.get("image") as File | null);
    await supabase.from("announcements").insert({
      kind, title: text(form, "title"), body: opt(form, "body"), body_original: opt(form, "body"), image_path, link_url: opt(form, "link_url"),
      starts_on: opt(form, "starts_on"), ends_on: opt(form, "ends_on"), slots: kind === "serving" ? Number(text(form, "slots") || 0) || null : null,
      status: person.is_admin ? "approved" : "suggested", submitted_by: person.id,
    });
  } catch (e) {
    bounce(back, { error: (e as Error).message });
  }
  bounce(back, { ok: person.is_admin ? "Posted." : "Thanks. The church office will review it before it goes out." });
}

export async function toggleServing(form: FormData) {
  const person = await requireMember();
  const b = await base();
  const supabase = await supabaseServer();
  const announcement_id = text(form, "announcement_id");
  const { data } = await supabase.from("serving_signups").select("person_id").eq("announcement_id", announcement_id).eq("person_id", person.id).maybeSingle();
  if (data) await supabase.from("serving_signups").delete().eq("announcement_id", announcement_id).eq("person_id", person.id);
  else await supabase.from("serving_signups").insert({ announcement_id, person_id: person.id, note: opt(form, "note") });
  redirect(`${b}/serving`);
}

// ---- Forms ---------------------------------------------------------------

export async function submitForm(form: FormData) {
  const person = await requireMember();
  const b = await base();
  const supabase = await supabaseServer();
  const kind = text(form, "kind");
  const data: Record<string, string> = {};
  form.forEach((v, k) => { if (k !== "kind" && typeof v === "string" && v.trim()) data[k] = v.trim(); });
  await supabase.from("form_submissions").insert({ kind, person_id: person.id, data });
  bounce(`${b}/forms`, { ok: "Sent to the church office. Thank you." });
}
