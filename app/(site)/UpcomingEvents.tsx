import Link from "next/link";
import { eventDate, eventDay, eventMonth, eventTime, publicImage, upcomingPublicEvents } from "../../lib/public-events";

// "Coming up at Beulah" for the public site. Renders nothing when the
// calendar is empty so the page never shows an empty box.
export async function UpcomingEvents({ limit = 4, heading = "Coming up at Beulah", showAllLink = true }: { limit?: number; heading?: string; showAllLink?: boolean }) {
  const events = await upcomingPublicEvents(limit);
  if (!events.length) return null;
  return (
    <section className="section wrap upcoming" id="events">
      <div className="section-heading centered">
        <p className="eyebrow">Calendar</p>
        <h2>{heading}</h2>
        <p>Everyone is welcome. Members can RSVP and see more in the members app.</p>
      </div>
      <div className="upcoming-grid">
        {events.map((e) => {
          const img = publicImage(e.image_path);
          return (
            <article className="upcoming-card" key={e.id}>
              {img && <img src={img} alt="" />}
              <div className="upcoming-body">
                <div className="upcoming-date"><small>{eventMonth(e)}</small><b>{eventDate(e)}</b></div>
                <div>
                  <h3>{e.title}</h3>
                  <p className="upcoming-when">{eventDay(e)} · {eventTime(e)}{e.location ? ` · ${e.location}` : ""}</p>
                  {e.description && <p className="upcoming-copy">{e.description}</p>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {showAllLink && <p style={{ textAlign: "center", marginTop: 30 }}><Link className="text-link" href="/fellowships-events#events">See the full calendar <span>→</span></Link></p>}
    </section>
  );
}
