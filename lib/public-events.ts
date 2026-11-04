import { createClient } from "@supabase/supabase-js";

// Upcoming events for the public website. Reads the public_events view with
// the anon key (no login), so only approved events marked for the website
// come through. Cached for five minutes.
export type PublicEvent = { id: string; title: string; description: string | null; location: string | null; starts_at: string; ends_at: string | null; all_day: boolean; image_path: string | null };

export async function upcomingPublicEvents(limit = 6): Promise<PublicEvent[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false }, global: { fetch: (input, init) => fetch(input, { ...init, next: { revalidate: 300 } }) } });
    const { data } = await supabase.from("public_events").select("*").order("starts_at").limit(limit);
    return (data ?? []) as PublicEvent[];
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
