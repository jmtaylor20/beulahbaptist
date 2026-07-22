import type { Metadata } from "next";
export const metadata: Metadata = { title: "About Us", description: "The mission, beliefs, leadership, and history of Beulah Baptist Church." };
const beliefs = [
  ["The Bible", "We believe the Bible is God’s inspired Word, true and trustworthy, and our final authority for faith and life."],
  ["God", "We believe in one God who eternally exists as Father, Son, and Holy Spirit."],
  ["Jesus Christ", "We believe Jesus is fully God and fully man, lived without sin, died for our sins, rose bodily, and will return."],
  ["Salvation", "We believe salvation is God’s gift of grace, received through repentance and faith in Jesus Christ—not earned by good works."],
  ["The Church", "We believe the local church is a family of believers called to worship, grow, serve, and share the gospel."],
  ["Baptism & Communion", "We practice believer’s baptism by immersion and observe the Lord’s Supper in remembrance of Christ."],
];
export default function About() { return <main>
  <section className="hero interior-hero"><div className="hero-content wrap"><p className="breadcrumbs">Home / About Us</p><h1>Rooted in truth.<br />Growing in grace.</h1></div></section>
  <section className="section wrap content-grid"><aside className="side-nav"><a href="#mission">Our Mission</a><a href="#beliefs">Our Beliefs</a><a href="#pastor">Our Pastor</a><a href="#history">Church History</a></aside><article className="article">
    <section id="mission"><p className="eyebrow">Why we’re here</p><h2>Our Mission</h2><p className="large-copy">Love God. Love people. Make disciples.</p><p>Beulah Baptist Church exists to glorify God by proclaiming the good news of Jesus Christ, helping believers grow in His Word, caring for one another, and serving our neighbors near and far.</p><p>We are a Southern Baptist church and a member of the Tallapoosa Baptist Association.</p></section>
    <section id="beliefs"><p className="eyebrow">What we believe</p><h2>Anchored in Scripture</h2><p>These core convictions shape our worship, teaching, ministries, and life together.</p><div className="belief-grid">{beliefs.map(([title,copy])=><div className="plain-card" key={title}><h3>{title}</h3><p>{copy}</p></div>)}</div></section>
    <section id="pastor"><p className="eyebrow">Shepherding God’s people</p><h2>Our Pastor</h2><div className="image-callout"><img src="/images/church-hero.jpg" alt="Beulah Baptist Church at sunset" /><div><h3>Timothy R. Davis</h3><p>Pastor Timothy R. Davis serves through faithful preaching, prayer, pastoral care, and a desire to see people know Christ and mature in their faith. Each message aims to explain Scripture clearly and apply it honestly to everyday life.</p></div></div></section>
    <section id="history"><p className="eyebrow">Since 1893</p><h2>Church History</h2><p>For generations, Beulah Baptist Church has gathered in faith, served families, and shared the gospel in its community. The buildings and ministries have grown over time, but the foundation remains the same: Jesus Christ and the truth of His Word.</p><p>Today, Beulah continues that legacy through worship, discipleship, missions, fellowship, and practical care for our neighbors. As a Southern Baptist congregation and member of the Tallapoosa Baptist Association, we cooperate with other churches to advance gospel ministry locally and beyond.</p></section>
  </article></section>
</main>; }
