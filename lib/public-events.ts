import { createClient } from "@supabase/supabase-js";

// Upcoming events for the public website. Reads the public_events view with
// the anon key (no login), so only approved events marked for the website
// come through. Cached for five minutes.
export type PublicEvent = { id: string; title: string; description: string | null; location: string | null; starts_at: string; ends_at: string | null; all_day: boolean; image_path: string | null };

export type PublicAnnouncement = { id: string; title: string; body: string | null; image_path: string | null; link_url: string | null; starts_on: string | null; ends_on: string | null; created_at: string };

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: (input, init) => fetch(input, { ...init, next: { revalidate: 300 } }) } });
}

export async function upcomingPublicEvents(limit = 6): Promise<PublicEvent[]> {
  const supabase = publicClient();
  if (!supabase) return [];
  try {
    // Ask for a few extra: the view keeps yesterday's events, and those that
    // have already finished are dropped here.
    const { data } = await supabase.from("public_events").select("*").order("starts_at").limit(limit + 5);
    return ((data ?? []) as PublicEvent[]).filter((e) => !hasEnded(e)).slice(0, limit);
  } catch {
    return [];
  }
}

// Current announcements marked for the website, newest first. Returns an
// empty list (rather than failing the page) if the view is not there yet.
export async function currentPublicAnnouncements(limit = 6): Promise<PublicAnnouncement[]> {
  const supabase = publicClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase.from("public_announcements").select("*").order("created_at", { ascending: false }).limit(limit);
    return (data ?? []) as PublicAnnouncement[];
  } catch {
    return [];
  }
}

export const publicImage = (path: string | null) => (path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-media/${path}` : null);
const central = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", ...opts });
export const eventDay = (e: PublicEvent) => central(e.starts_at, { weekday: "long", month: "long", day: "numeric" });
export const eventTime = (e: PublicEvent) => e.all_day ? "All day" : `${central(e.starts_at, { hour: "numeric", minute: "2-digit" })}${e.ends_at ? ` to ${central(e.ends_at, { hour: "numeric", minute: "2-digit" })}` : ""}`;
export const eventMonth = (e: PublicEvent) => central(e.starts_at, { month: "short" });
export const eventDate = (e: PublicEvent) => central(e.starts_at, { day: "numeric" });

// An event is over once its end time passes; with no end time, two hours
// after it starts; all-day events last through the end of their day.
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
export function hasEnded(e: PublicEvent, now = new Date()) {
  if (e.all_day) return dayKey(new Date(e.ends_at ?? e.starts_at)) < dayKey(now);
  const end = e.ends_at ? new Date(e.ends_at) : new Date(new Date(e.starts_at).getTime() + 2 * 3600_000);
  return end < now;
}
