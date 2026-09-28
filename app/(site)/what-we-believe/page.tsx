import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "What We Believe",
  description: "A concise overview of the Baptist Faith and Message 2000 affirmed by Beulah Baptist Church.",
};

const articles = [
  ["I", "The Scriptures", "The Bible is God’s inspired, trustworthy Word and the final authority for faith, teaching, and daily life. All Scripture points us to Jesus Christ."],
  ["II", "God", "There is one living and true God who eternally reveals Himself as Father, Son, and Holy Spirit—distinct in person and united in divine nature."],
  ["III", "Man", "Every person is created in God’s image and possesses dignity, yet all people are separated from God by sin and need His grace."],
  ["IV", "Salvation", "Salvation is offered freely through Jesus Christ and received through repentance and faith. God’s saving work includes regeneration, justification, sanctification, and glorification."],
  ["V", "God’s Purpose of Grace", "God graciously brings believers into His family and keeps them by His power. Those who truly belong to Christ will persevere in faith to the end."],
  ["VI", "The Church", "A local church is an autonomous congregation of baptized believers who worship, serve, observe Christ’s ordinances, and carry the gospel into the world."],
  ["VII", "Baptism and the Lord’s Supper", "Christian baptism is the immersion of a believer in water as a testimony of faith in Christ. The Lord’s Supper remembers His death and anticipates His return."],
  ["VIII", "The Lord’s Day", "Sunday is a day for worship and spiritual devotion, celebrating the resurrection of Jesus and gathering with His church."],
  ["IX", "The Kingdom", "God’s Kingdom is His rule in every age and the willing obedience of those who trust Him. Christians pray and work for His will to be done on earth."],
  ["X", "Last Things", "God will bring history to its appointed conclusion. Jesus Christ will return, all people will be judged, and God’s redeemed will dwell with Him forever."],
  ["XI", "Evangelism and Missions", "Every follower of Christ and every church is called to make disciples, proclaim the gospel, and seek to bring others to faith in Jesus."],
  ["XII", "Education", "Christian education supports the church’s mission and should unite diligent learning with a faithful commitment to the truth revealed in Scripture."],
  ["XIII", "Stewardship", "Everything belongs to God. Christians gladly give their time, abilities, influence, and resources to serve Him and help others."],
  ["XIV", "Cooperation", "Churches may voluntarily work together to advance the gospel while each local congregation remains responsible to Christ as its Lord."],
  ["XV", "The Christian and the Social Order", "Christians should seek justice, care for neighbors, oppose exploitation and prejudice, and pursue what is good through the love and truth of Christ."],
  ["XVI", "Peace and War", "Followers of Jesus should pursue peace with all people on the principles of righteousness while praying and working for the reign of the Prince of Peace."],
  ["XVII", "Religious Liberty", "God alone is Lord of the conscience. Church and government should remain separate, and every person should be free to worship according to conviction."],
  ["XVIII", "The Family", "God established the family as the foundational institution of human society. Marriage, parenthood, and family life are to reflect faithful, sacrificial love and biblical responsibility."],
];

export default function WhatWeBelieve() {
  return <main>
    <section className="hero interior-hero"><div className="hero-content wrap"><p className="breadcrumbs">Home / What We Believe</p><h1>Truth that shapes<br />the way we live.</h1></div></section>
    <section className="section wrap beliefs-intro">
      <div><p className="eyebrow">Our statement of faith</p><h2>The Baptist Faith &amp; Message</h2></div>
      <div><p className="large-copy">Beulah Baptist Church is a Southern Baptist congregation. We affirm the Baptist Faith and Message 2000 as a faithful summary of our biblical convictions.</p><p>The overview below introduces its eighteen articles in clear, concise language. The official statement includes the complete wording and supporting Scripture references.</p><div className="button-row"><a className="button navy" href="https://bfm.sbc.net/bfm2000/" target="_blank" rel="noreferrer">Read the Official Statement ↗</a><Link className="button outline" href="/contact">Ask Us a Question</Link></div></div>
    </section>
    <section className="beliefs-section"><div className="wrap"><div className="section-heading"><p className="eyebrow">Eighteen articles of faith</p><h2>What we believe</h2><p>This is a brief overview; the official Baptist Faith and Message 2000 remains our complete statement.</p></div><div className="belief-article-grid">{articles.map(([number,title,copy]) => <article className="belief-article" key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div></div></section>
    <section className="section wrap visit-cta"><img src="/images/logo-seal.png" alt="Beulah Baptist Church seal" /><div><p className="eyebrow">Come learn with us</p><h2>Questions are welcome.</h2><p>We would be glad to talk with you about our faith, our church, or what it means to follow Jesus.</p></div><Link className="button gold" href="/plan-your-visit">Plan Your Visit</Link></section>
  </main>;
}
