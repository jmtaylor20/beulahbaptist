import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

// The members app lives at /app on the main site and at the root of
// app.beulahbaptistchurch.com (proxy.ts rewrites the subdomain). Links are
// built with base() so they stay clean on both.
export async function base() {
  const h = await headers();
  return h.get("x-app-base") === "root" ? "" : "/app";
}

export type Person = {
  id: string; auth_user_id: string | null; household_id: string | null;
  first_name: string; last_name: string; email: string | null; phone: string | null; birthday: string | null;
  role: "head" | "spouse" | "child" | "other"; is_minor: boolean; photo_path: string | null; bio: string | null;
  show_email: "members" | "church"; show_phone: "members" | "church"; show_birthday: "members" | "church"; show_address: "members" | "church";
  bible_translation: string; status: "pending" | "active" | "inactive" | "declined"; is_admin: boolean;
  request_note: string | null; admin_notes: string | null; created_at: string;
};

export type Household = {
  id: string; name: string; address: string | null; city: string | null; state: string | null; zip: string | null;
  home_phone: string | null; anniversary: string | null; photo_path: string | null; admin_notes: string | null;
};

// Who is signed in, as a people row. Null when signed out or not yet in the directory.
export async function currentPerson(): Promise<Person | null> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("people").select("*").eq("auth_user_id", user.id).maybeSingle();
  return (data as Person | null) ?? null;
}

// Guards for layouts. Each sends the visitor to the right place instead of a blank page.
export async function requireMember() {
  const b = await base();
  const person = await currentPerson();
  if (!person) redirect(`${b}/login`);
  if (person.status !== "active") redirect(`${b}/pending`);
  return person;
}

export async function requireAdmin() {
  const b = await base();
  const person = await requireMember();
  if (!person.is_admin) redirect(b);
  return person;
}

export const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;

export const fmtDate = (value: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("en-US", { timeZone: "America/Chicago", ...opts }) : "";

export const fmtTime = (value: string) => new Date(value).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });

// Turns a datetime-local value typed in Central time into an ISO string,
// using the right offset for that date (CST or CDT).
export function centralToIso(local: string) {
  if (!local) return null;
  const [date, time = "12:00"] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return new Date(guess + (guess - shown)).toISOString();
}

// Birthdays and anniversaries are shown without the year.
export const monthDay = (value: string | null | undefined) => fmtDate(value, { month: "long", day: "numeric" });

export const publicMediaUrl = (path: string | null | undefined) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-media/${path}` : null;

// Member photos are private; hand out short-lived signed URLs.
export async function photoUrl(path: string | null | undefined) {
  if (!path) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.storage.from("member-photos").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function photoUrls(paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (!unique.length) return new Map<string, string>();
  const supabase = await supabaseServer();
  const { data } = await supabase.storage.from("member-photos").createSignedUrls(unique, 60 * 60);
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl]));
}
