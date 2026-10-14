import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Fall Bingo Fundraiser",
  description: "Union Community Center’s Annual Fall Bingo Fundraiser — Saturday, October 17, 2026, from 5:30 PM at 4191 Hwy 50, Dadeville, AL.",
  openGraph: { title: "Fall Bingo Fundraiser · Saturday, Oct 17", description: "Bingo, great prizes, concessions, fellowship, and a football game watch party in Dadeville.", images: [{ url: "/images/fall-bingo-2026.webp", width: 1545, height: 1999, alt: "Fall Bingo Fundraiser flyer" }] },
};

const mapsUrl = "https://www.google.com/maps/search/?api=1&query=4191+Hwy+50+Dadeville+AL";

export default function FallBingo() {
  return (
    <main>
      <section className="hero interior-hero">
        <div className="hero-content wrap">
          <p className="breadcrumbs">Home / Events / Fall Bingo</p>
          <h1>Fall Bingo<br />Fundraiser</h1>
        </div>
      </section>
      <section className="section wrap event-feature">
        <a className="event-flyer" href="/images/fall-bingo-2026.webp" target="_blank" rel="noreferrer">
          <img src="/images/fall-bingo-2026.webp" width={1545} height={1999} alt="Union Community Center Annual Fall Bingo Fundraiser flyer" />
        </a>
        <div>
          <p className="eyebrow">Special event</p>
          <h2>Union Community Center Annual Fall Bingo</h2>
          <div className="event-facts">
            <p><span>When</span><strong>Saturday, October 17, 2026</strong></p>
            <p><span>Time</span><strong>5:30 PM until the last prize is given</strong></p>
            <p><span>Where</span><strong>4191 Hwy 50, Dadeville, AL</strong></p>
          </div>
          <div className="large-copy">
            <p>Come out and support UCC with their annual bingo fundraiser! Proceeds go toward keeping the community center open for the community.</p>
            <p>Come ready for bingo, great prizes, concessions, fellowship, and a football game watch party. Bring your family and invite a neighbor.</p>
          </div>
          <div className="button-row">
            <a className="button navy" href={mapsUrl} target="_blank" rel="noreferrer">Get directions</a>
            <Link className="button outline" href="/fellowships-events">More events</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
