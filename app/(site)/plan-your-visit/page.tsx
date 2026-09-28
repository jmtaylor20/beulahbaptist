import type { Metadata } from "next";
import { ContactForm } from "../ui";

export const metadata: Metadata = { title: "Plan Your Visit", description: "What to expect when you visit Beulah Baptist Church." };

const items = [
  ["A warm welcome", "Friendly people will be nearby to help, but you won’t be singled out or put on the spot."],
  ["Bible-centered worship", "Expect congregational singing, prayer, and practical, expository preaching from God’s Word."],
  ["Come as you are", "You’ll see everything from jeans to Sunday best. Wear what makes you comfortable."],
  ["Something for every age", "Sunday School offers age-appropriate Bible study and a natural way to meet people."],
];

export default function PlanVisit() {
  return <main>
    <section className="hero interior-hero"><div className="hero-content wrap"><p className="breadcrumbs">Home / Plan Your Visit</p><h1>Your first Sunday,<br />made simple.</h1></div></section>
    <section className="section wrap content-grid">
      <aside className="side-nav"><a href="#expect">What to expect</a><a href="#parking">Parking</a><a href="#children">Nursery & children</a><a href="#sunday-school">Sunday School</a><a href="#contact">Contact</a><a href="#visitor-form">Visitor form</a></aside>
      <article className="article">
        <section id="expect"><p className="eyebrow">Welcome to Beulah</p><h2>What to expect</h2><p>Visiting a church can feel like a big step. We want your first morning at Beulah to feel clear, comfortable, and unhurried.</p><div className="expect-grid">{items.map(([title, copy], i) => <div className="plain-card" key={title}><span className="eyebrow">0{i+1}</span><h3>{title}</h3><p>{copy}</p></div>)}</div></section>
        <section id="parking"><p className="eyebrow">When you arrive</p><h2>Where to park</h2><p>Parking surrounds the main church building. Accessible spaces are located closest to the front entrance. If you arrive a few minutes early, a greeter can point you toward the sanctuary, nursery, or a Sunday School class.</p><div className="image-callout"><img src="/images/church-aerial.jpg" alt="Aerial view of Beulah Baptist Church and parking area" /><div><h3>5891 Lovelady Road</h3><p>Dadeville, Alabama 36853<br /><a href="tel:+12568256515">256-825-6515</a></p><a className="text-link" href="https://www.google.com/maps/search/?api=1&query=5891+Lovelady+Road+Dadeville+AL+36853" target="_blank" rel="noreferrer">Open directions ↗</a></div></div></section>
        <section id="children"><p className="eyebrow">For families</p><h2>Nursery & children</h2><p>A caring nursery is available for little ones during scheduled services. Children’s Church provides a safe, age-appropriate setting where children learn biblical truth in a way they can understand. A volunteer can help you find the right room when you arrive.</p><p>For details about check-in, ages, or a child’s particular needs, use the visitor form below and our team will help you prepare.</p></section>
        <section id="sunday-school"><p className="eyebrow">Grow together</p><h2>Sunday School</h2><p>Sunday School begins at 10:00 AM and offers Bible study for children, students, and adults. Classes are relaxed, welcoming, and a good first step toward building relationships at Beulah.</p><div className="plain-card visit-schedule"><h3>Sunday morning at a glance</h3><p><strong>9:00 AM</strong> · Contemporary Worship in the Fellowship Hall<br/><strong>10:00 AM</strong> · Sunday School<br/><strong>11:00 AM</strong> · Traditional Service in the Sanctuary</p></div></section>
        <section id="contact"><p className="eyebrow">Need help?</p><h2>We’re here for you</h2><p>Have a question about accessibility, children’s ministry, what to wear, or anything else? Send a note through the visitor form and we’ll help make your first visit easier.</p></section>
        <section id="visitor-form"><p className="eyebrow">We’ll save you a seat</p><h2>Let us know you’re coming</h2><ContactForm kind="visitor" /></section>
      </article>
    </section>
  </main>;
}
