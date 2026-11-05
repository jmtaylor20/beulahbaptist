import { currentPublicAnnouncements, eventDate, eventDay, eventMonth, eventTime, publicImage, upcomingPublicEvents } from "../../lib/public-events";
import { HighlightsCarousel, type Slide } from "./HighlightsCarousel";

// Titles compared loosely: case, punctuation and extra spaces ignored.
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// The same thing is often posted as an announcement and as an event. Treat
// them as one when the titles match, or when one title contains the other
// and the shorter has at least two words ("Silent Bake Sale" inside
// "Silent Bake Sale Auction Fundraiser").
const sameThing = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  if (x === y) return true;
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  return short.split(" ").length >= 2 && ` ${long} `.includes(` ${short} `);
};

// "Happening at Beulah": announcements and upcoming calendar events in one
// carousel at the top of the home page. Renders nothing when both are empty.
export async function Highlights() {
  const [announcements, events] = await Promise.all([currentPublicAnnouncements(8), upcomingPublicEvents(8)]);
  const eventSlides = events.map((e): Slide => {
    const twin = announcements.find((a) => sameThing(a.title, e.title));
    return {
      id: `e-${e.id}`, kind: "event", label: eventDay(e), title: e.title,
      meta: `${eventTime(e)}${e.location ? ` · ${e.location}` : ""}`, copy: e.description ?? twin?.body,
      image: publicImage(e.image_path) ?? publicImage(twin?.image_path ?? null), month: eventMonth(e), day: eventDate(e), href: "/fellowships-events#events",
    };
  });
  const announcementSlides = announcements
    .filter((a) => !events.some((e) => sameThing(a.title, e.title)))
    .map((a): Slide => ({
      id: `a-${a.id}`, kind: "announcement", label: "", title: a.title,
      copy: a.body, image: publicImage(a.image_path), href: a.link_url, external: !!a.link_url && /^https?:/i.test(a.link_url),
    }));
  const slides = [...announcementSlides, ...eventSlides];
  if (!slides.length) return null;
  return <HighlightsCarousel slides={slides} />;
}
