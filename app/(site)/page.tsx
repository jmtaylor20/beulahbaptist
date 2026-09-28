import Link from "next/link";
import { ContactForm } from "./ui";

const ministryCards = [
  { title: "Children", copy: "Nursery, Children’s Church, AWANA, VBS & more", image: "/images/children.jpg", anchor: "children" },
  { title: "Youth", copy: "Weekly ministry, Sunday School, missions & activities", image: "/images/youth.jpg", anchor: "youth" },
  { title: "Adults", copy: "Sunday School, Sisterhood, Man Church & JOY", image: "/images/joy.jpg", anchor: "adults" },
  { title: "Outreach", copy: "Teachers Luncheon, community outreach & missions", image: "/images/outreach.jpg", anchor: "outreach" },
];

export default function Home() {
  return (
    <main>
      <section className="hero home-hero">
        <div className="hero-shade" />
        <div className="hero-content wrap">
          <p className="eyebrow light">Faith · Family · Fellowship</p>
          <h1>Welcome to <em>Beulah</em></h1>
          <p className="hero-lead">A country church with a heart for God, a love for people, and a place for your family.</p>
          <div className="button-row">
            <Link className="button gold" href="/plan-your-visit">Plan your visit</Link>
            <Link className="button ghost" href="#service-times">Service times</Link>
          </div>
        </div>
        <a className="scroll-cue" href="#welcome" aria-label="Continue to welcome message">↓</a>
      </section>

      <section id="welcome" className="section welcome-grid wrap">
        <div>
          <p className="eyebrow">You’re welcome here</p>
          <h2>Come as you are.<br />Find a place to belong.</h2>
        </div>
        <div className="prose large-copy">
          <p>At Beulah Baptist Church, you’ll find a warm welcome, Bible-centered teaching, uplifting worship, and people who are ready to walk alongside you.</p>
          <p>Whether church has always been part of your story or you’re simply curious, we would be glad to meet you.</p>
          <Link className="text-link" href="/about">Get to know Beulah <span>→</span></Link>
        </div>
      </section>

      <section id="service-times" className="info-band">
        <div className="wrap info-grid">
          <div className="info-intro">
            <span className="icon-circle">S</span>
            <p className="eyebrow light">Gather with us</p>
            <h2>Sundays & Wednesdays</h2>
          </div>
          <div className="schedule-list">
            <div className="schedule-day"><h3>Sunday mornings</h3><p><span>Contemporary Worship <small>Fellowship Hall</small></span><strong>9:00 AM</strong></p><p><span>Sunday School</span><strong>10:00 AM</strong></p><p><span>Traditional Service <small>Sanctuary</small></span><strong>11:00 AM</strong></p></div>
            <div className="schedule-day"><h3>Sunday nights</h3><p><span>Man Church & Sweet Hour of Prayer</span><strong>6:00 PM</strong></p></div>
            <div className="schedule-day"><h3>Wednesday nights</h3><p><span>Feed the Sheep</span><strong>5:30 PM</strong></p><p><span>Classes <small>Youth, AWANA & adults</small></span><strong>6:00 PM</strong></p></div>
          </div>
          <div className="location-card">
            <span className="pin">●</span>
            <h3>Find us in Dadeville</h3>
            <p>5891 Lovelady Road<br />Dadeville, AL 36853</p>
            <p><a href="tel:+12568256515">256-825-6515</a></p>
            <a className="text-link light-link" href="https://www.google.com/maps/search/?api=1&query=5891+Lovelady+Road+Dadeville+AL+36853" target="_blank" rel="noreferrer">Get directions <span>↗</span></a>
          </div>
        </div>
      </section>

      <section className="section ministries-preview wrap">
        <div className="section-heading centered">
          <p className="eyebrow">There’s a place for you</p>
          <h2>Explore our ministries</h2>
          <p>Growing in faith happens best together—in every season of life.</p>
        </div>
        <div className="photo-card-grid">
          {ministryCards.map((card) => (
            <Link className="photo-card" href={`/ministries#${card.anchor}`} key={card.title}>
              <img src={card.image} alt="" />
              <div><span className="card-number">+</span><h3>{card.title}</h3><p>{card.copy}</p><b>Learn more →</b></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="split-feature">
        <div className="split-image worship-image" role="img" aria-label="Beulah Baptist Church at sunset" />
        <div className="split-copy">
          <p className="eyebrow">Worship with us</p>
          <h2>Truth for life.<br />Grace for every day.</h2>
          <p>Our services center on God’s Word, congregational singing, prayer, and the good news of Jesus Christ. You don’t have to know what to do or what to wear—just come.</p>
          <Link className="button navy" href="/plan-your-visit">Know what to expect</Link>
        </div>
      </section>

      <section className="prayer-band">
        <div className="wrap prayer-layout">
          <div>
            <p className="eyebrow light">How can we pray for you?</p>
            <h2>You don’t have to carry it alone.</h2>
            <p>Share as much or as little as you feel comfortable sharing. Our church family would be honored to pray with you.</p>
          </div>
          <ContactForm kind="prayer" compact />
        </div>
      </section>

      <section className="section visit-cta wrap">
        <img src="/images/logo-seal.png" alt="Beulah Baptist Church — established 1893" />
        <div>
          <p className="eyebrow">Your first Sunday</p>
          <h2>We can’t wait to meet you.</h2>
          <p>Tell us you’re coming and we’ll help make your visit simple—from parking to Sunday School.</p>
        </div>
        <Link className="button navy" href="/plan-your-visit#visitor-form">Plan your visit</Link>
      </section>
    </main>
  );
}
