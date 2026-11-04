"use server";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { base, centralToIso, fmtDate, fmtTime, monthDay, publicMediaUrl, requireAdmin } from "../../../../lib/members";
import { supabaseServer } from "../../../../lib/supabase/server";
import { approvalEmail, renderNewsletter, sendBulk, sendEmail, type NewsletterData } from "../../../../lib/email";
import { polishAnnouncement } from "../../../../lib/polish";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const opt = (form: FormData, key: string) => text(form, key) || null;
const on = (form: FormData, key: string) => form.get(key) === "on";
const bounce = (path: string, params: Record<string, string>) => redirect(`${path}?${new URLSearchParams(params)}`);

async function upload(bucket: "member-photos" | "public-media", folder: string, file: File | null) {
  if (!file || !file.size) return null;
  const supabase = await supabaseServer();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

// ---- People ----------------------------------------------------------------

export async function setStatus(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  const id = text(form, "id"), status = text(form, "status");
  const { data: p } = await supabase.from("people").select("first_name,email,status").eq("id", id).maybeSingle();
  await supabase.from("people").update({ status }).eq("id", id);
  let note = `${p?.first_name ?? "Member"} is now ${status}.`;
  if (status === "active" && p?.status !== "active" && p?.email) {
    try { const m = approvalEmail(p.first_name); await sendEmail(p.email, m.subject, m.html); note += " Welcome email sent."; }
    catch (e) { note += ` (Email not sent: ${(e as Error).message})`; }
  }
  bounce(`${b}/admin/people/${id}`, { ok: note });
}

export async function savePerson(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  const id = text(form, "id");
  try {
    const row = {
      first_name: text(form, "first_name"), last_name: text(form, "last_name"), household_id: opt(form, "household_id"), role: text(form, "role") || "other",
      email: opt(form, "email"), phone: opt(form, "phone"), birthday: opt(form, "birthday"), admin_notes: opt(form, "admin_notes"),
      is_minor: on(form, "is_minor"), is_admin: on(form, "is_admin"), status: text(form, "status") || "active",
      show_email: text(form, "show_email"), show_phone: text(form, "show_phone"), show_birthday: text(form, "show_birthday"), show_address: text(form, "show_address"),
    };
    if (id) {
      const photo_path = await upload("member-photos", `admin/${id}`, form.get("photo") as File | null);
      const { error } = await supabase.from("people").update(photo_path ? { ...row, photo_path } : row).eq("id", id);
      if (error) throw new Error(error.message);
      bounce(`${b}/admin/people/${id}`, { ok: "Saved." });
    } else {
      const { data, error } = await supabase.from("people").insert(row).select("id").single();
      if (error) throw new Error(error.message);
      const photo_path = await upload("member-photos", `admin/${data.id}`, form.get("photo") as File | null);
      if (photo_path) await supabase.from("people").update({ photo_path }).eq("id", data.id);
      bounce(`${b}/admin/people/${data.id}`, { ok: "Added." });
    }
  } catch (e) {
    if (isRedirectError(e)) throw e;
    bounce(`${b}/admin/people/${id || "new"}`, { error: (e as Error).message });
  }
}

export async function deletePerson(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  await supabase.from("people").delete().eq("id", text(form, "id"));
  bounce(`${b}/admin/people`, { ok: "Deleted." });
}

export async function createHousehold(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  const { data } = await supabase.from("households").insert({ name: text(form, "name") }).select("id").single();
  redirect(`${b}/admin/people/household/${data?.id}`);
}

export async function saveHousehold(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  const id = text(form, "id");
  try {
    const photo_path = await upload("member-photos", `admin/household/${id}`, form.get("photo") as File | null);
    const row = { name: text(form, "name"), address: opt(form, "address"), city: opt(form, "city"), state: opt(form, "state") ?? "AL", zip: opt(form, "zip"), home_phone: opt(form, "home_phone"), anniversary: opt(form, "anniversary"), admin_notes: opt(form, "admin_notes") };
    const { error } = await supabase.from("households").update(photo_path ? { ...row, photo_path } : row).eq("id", id);
    if (error) throw new Error(error.message);
  } catch (e) {
    bounce(`${b}/admin/people/household/${id}`, { error: (e as Error).message });
  }
  bounce(`${b}/admin/people/household/${id}`, { ok: "Saved." });
}

export async function deleteHousehold(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  await supabase.from("households").delete().eq("id", text(form, "id"));
  bounce(`${b}/admin/people`, { ok: "Household deleted." });
}

// ---- Announcements ---------------------------------------------------------

export async function saveAnnouncement(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  const id = text(form, "id");
  try {
    const image_path = await upload("public-media", "announcements/admin", form.get("image") as File | null);
    const row = {
      kind: text(form, "kind") === "serving" ? "serving" : "announcement", title: text(form, "title"), body: opt(form, "body"), link_url: opt(form, "link_url"),
      starts_on: opt(form, "starts_on"), ends_on: opt(form, "ends_on"), slots: Number(text(form, "slots")) || null,
      status: form.get("approve") ? "approved" : text(form, "status") || "draft",
      ...(image_path ? { image_path } : {}),
    };
    if (!row.title) throw new Error("A title is needed.");
    if (id) {
      const { error } = await supabase.from("announcements").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase.from("announcements").insert({ ...row, body_original: row.body }).select("id").single();
      if (error) throw new Error(error.message);
      bounce(`${b}/admin/announcements/${data.id}`, { ok: "Created." });
    }
  } catch (e) {
    if (isRedirectError(e)) throw e;
    bounce(`${b}/admin/announcements/${id || "new"}`, { error: (e as Error).message });
  }
  bounce(`${b}/admin/announcements/${id}`, { ok: form.get("approve") ? "Approved. It is live in the app and ready for the next email." : "Saved." });
}

export async function polish(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  const id = text(form, "id");
  const title = text(form, "title"), body = text(form, "body");
  if (!body) bounce(`${b}/admin/announcements/${id}`, { error: "Nothing to polish yet." });
  try {
    const polished = await polishAnnouncement(title, body);
    const { data: current } = await supabase.from("announcements").select("body_original").eq("id", id).maybeSingle();
    await supabase.from("announcements").update({ body: polished, body_original: current?.body_original ?? body }).eq("id", id);
  } catch (e) {
    bounce(`${b}/admin/announcements/${id}`, { error: (e as Error).message });
  }
  bounce(`${b}/admin/announcements/${id}`, { ok: "Polished. Compare with the original below, then save or approve." });
}

export async function revertPolish(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  const id = text(form, "id");
  const { data } = await supabase.from("announcements").select("body_original").eq("id", id).maybeSingle();
  if (data?.body_original) await supabase.from("announcements").update({ body: data.body_original }).eq("id", id);
  bounce(`${b}/admin/announcements/${id}`, { ok: "Original wording restored." });
}

export async function deleteAnnouncement(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  await supabase.from("announcements").delete().eq("id", text(form, "id"));
  bounce(`${b}/admin/announcements`, { ok: "Deleted." });
}

// ---- Events ----------------------------------------------------------------

export async function saveEvent(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  const id = text(form, "id");
  try {
    const image_path = await upload("public-media", "events/admin", form.get("image") as File | null);
    const startDate = text(form, "start_date"), startTime = text(form, "start_time"), endTime = text(form, "end_time"), endDate = text(form, "end_date") || startDate;
    const all_day = !startTime;
    const row = {
      title: text(form, "title"), description: opt(form, "description"), location: opt(form, "location"),
      starts_at: startDate ? centralToIso(`${startDate}T${startTime || "12:00"}`) : null,
      ends_at: endDate && endTime ? centralToIso(`${endDate}T${endTime}`) : null,
      all_day, rsvp_enabled: on(form, "rsvp_enabled"),
      status: form.get("approve") ? "approved" : text(form, "status") || "approved", ...(image_path ? { image_path } : {}),
    };
    if (!row.title || !row.starts_at) throw new Error("A title and a date are needed.");
    if (row.ends_at && row.ends_at < row.starts_at) throw new Error("The end time is before the start time.");
    if (id) {
      const { error } = await supabase.from("events").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase.from("events").insert(row).select("id").single();
      if (error) throw new Error(error.message);
      bounce(`${b}/admin/events/${data.id}`, { ok: "Created." });
    }
  } catch (e) {
    if (isRedirectError(e)) throw e;
    bounce(`${b}/admin/events/${id || "new"}`, { error: (e as Error).message });
  }
  bounce(`${b}/admin/events/${id}`, { ok: "Saved." });
}

export async function deleteEvent(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  await supabase.from("events").delete().eq("id", text(form, "id"));
  bounce(`${b}/admin/events`, { ok: "Deleted." });
}

// ---- Forms -----------------------------------------------------------------

export async function markFormHandled(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  await supabase.from("form_submissions").update({ handled_at: new Date().toISOString() }).eq("id", text(form, "id"));
  redirect(`${b}/admin/forms`);
}

// ---- Newsletter ------------------------------------------------------------

// Gathers everything the builder offers for this week's email.
export async function newsletterSources() {
  const supabase = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString();
  const [{ data: announcements }, { data: events }, { data: prayers }, { data: people }, { data: households }] = await Promise.all([
    supabase.from("announcements").select("id,kind,title,body,image_path,link_url,starts_on,ends_on,slots,serving_signups(person_id)").eq("status", "approved").or(`ends_on.is.null,ends_on.gte.${today}`).order("created_at", { ascending: false }),
    supabase.from("events").select("id,title,description,location,starts_at,all_day").eq("status", "approved").gte("starts_at", new Date().toISOString()).lte("starts_at", in14).order("starts_at"),
    supabase.from("prayer_requests").select("id,body,person_id,people(first_name,last_name)").eq("audience", "church").eq("newsletter_ok", true).is("answered_at", null).order("created_at", { ascending: false }).limit(10),
    supabase.from("people").select("id,first_name,last_name,birthday,status,email").eq("status", "active"),
    supabase.from("households").select("id,name,anniversary"),
  ]);
  const inWeek = (date: string | null) => {
    if (!date) return false;
    const d = new Date(`${date}T12:00:00`); const now = new Date();
    const next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
    const diff = (next.getTime() - now.getTime()) / 86400000;
    return diff >= -1 && diff <= 7;
  };
  return {
    announcements: (announcements ?? []).filter((a) => a.kind === "announcement"),
    serving: (announcements ?? []).filter((a) => a.kind === "serving"),
    events: events ?? [],
    prayers: (prayers ?? []).map((p) => ({ id: p.id, body: p.body, name: p.people ? `${(p.people as unknown as { first_name: string; last_name: string }).first_name} ${(p.people as unknown as { first_name: string; last_name: string }).last_name}` : null })),
    birthdays: (people ?? []).filter((p) => inWeek(p.birthday)).map((p) => ({ name: `${p.first_name} ${p.last_name}`, day: monthDay(p.birthday) })),
    anniversaries: (households ?? []).filter((h) => inWeek(h.anniversary)).map((h) => ({ name: h.name, day: monthDay(h.anniversary) })),
    recipients: (people ?? []).map((p) => p.email).filter((e): e is string => !!e),
  };
}

async function buildFromForm(form: FormData) {
  const src = await newsletterSources();
  const pick = (key: string) => new Set(form.getAll(key).map(String));
  const a = pick("announcement"), e = pick("event"), s = pick("serving"), p = pick("prayer");
  const data: NewsletterData = {
    subject: text(form, "subject") || "This week at Beulah", intro: opt(form, "intro"), template: opt(form, "template"),
    announcements: src.announcements.filter((x) => a.has(x.id)).map((x) => ({ title: x.title, body: x.body, image: publicMediaUrl(x.image_path), link: x.link_url })),
    events: src.events.filter((x) => e.has(x.id)).map((x) => ({ title: x.title, when: `${fmtDate(x.starts_at, { weekday: "long", month: "long", day: "numeric" })}${x.all_day ? "" : ` at ${fmtTime(x.starts_at)}`}`, where: x.location, description: x.description })),
    serving: src.serving.filter((x) => s.has(x.id)).map((x) => ({ title: x.title, body: x.body, filled: (x.serving_signups as unknown[]).length, slots: x.slots })),
    birthdays: on(form, "include_birthdays") ? src.birthdays : [], anniversaries: on(form, "include_birthdays") ? src.anniversaries : [],
    prayers: src.prayers.filter((x) => p.has(x.id)).map((x) => ({ body: x.body, name: x.name })),
    verse: text(form, "verse_text") ? { text: text(form, "verse_text"), ref: text(form, "verse_ref") } : null,
  };
  return { data, html: renderNewsletter(data), recipients: src.recipients, ids: { a: [...a], e: [...e] } };
}

export async function previewNewsletter(form: FormData) {
  const me = await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  const { data, html, ids } = await buildFromForm(form);
  const id = text(form, "id");
  const row = { subject: data.subject, template: data.template ?? "classic", intro: data.intro, announcement_ids: ids.a, event_ids: ids.e, include_birthdays: data.birthdays.length > 0 || on(form, "include_birthdays"), html, created_by: me.id };
  const saved = id ? await supabase.from("newsletters").update(row).eq("id", id).select("id").single() : await supabase.from("newsletters").insert(row).select("id").single();
  if (form.get("test")) {
    try { await sendEmail(me.email!, `[Test] ${data.subject}`, html); bounce(`${b}/admin/newsletter/${saved.data?.id}`, { ok: `Test sent to ${me.email}.` }); }
    catch (e) { if (isRedirectError(e)) throw e; bounce(`${b}/admin/newsletter/${saved.data?.id}`, { error: (e as Error).message }); }
  }
  bounce(`${b}/admin/newsletter/${saved.data?.id}`, { ok: "Draft saved. Preview below." });
}

export async function sendNewsletter(form: FormData) {
  await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  const id = text(form, "id");
  const { data: n } = await supabase.from("newsletters").select("subject,html,sent_at").eq("id", id).maybeSingle();
  if (!n?.html) bounce(`${b}/admin/newsletter/${id}`, { error: "Save a preview first." });
  if (n!.sent_at) bounce(`${b}/admin/newsletter/${id}`, { error: "This one already went out." });
  const { recipients } = await newsletterSources();
  try {
    const count = await sendBulk(recipients, n!.subject, n!.html!);
    await supabase.from("newsletters").update({ sent_at: new Date().toISOString(), recipient_count: count }).eq("id", id);
    bounce(`${b}/admin/newsletter`, { ok: `Sent to ${count} members.` });
  } catch (e) {
    if (isRedirectError(e)) throw e; bounce(`${b}/admin/newsletter/${id}`, { error: (e as Error).message });
  }
}
