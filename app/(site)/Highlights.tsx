import { currentPublicAnnouncements, eventDate, eventDay, eventMonth, eventTime, publicImage, upcomingPublicEvents } from "../../lib/public-events";
import { HighlightsCarousel, type Slide } from "./HighlightsCarousel";

// "Happening at Beulah": announcements and upcoming calendar events in one
// carousel at the top of the home page. Renders nothing when both are empty.
export async function Highlights() {
  const [announcements, events] = await Promise.all([currentPublicAnnouncements(6), upcomingPublicEvents(8)]);
  const slides: Slide[] = [
    ...announcements.map((a): Slide => ({
      id: `a-${a.id}`, kind: "announcement", label: "Announcement", title: a.title,
      copy: a.body, image: publicImage(a.image_path), href: a.link_url, external: !!a.link_url && /^https?:/i.test(a.link_url),
    })),
    ...events.map((e): Slide => ({
      id: `e-${e.id}`, kind: "event", label: eventDay(e), title: e.title,
      meta: `${eventTime(e)}${e.location ? ` · ${e.location}` : ""}`, copy: e.description,
      image: publicImage(e.image_path), month: eventMonth(e), day: eventDate(e), href: "/fellowships-events#events",
    })),
  ];
  if (!slides.length) return null;
  return <HighlightsCarousel slides={slides} />;
}
