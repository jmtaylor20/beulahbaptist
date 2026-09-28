import Link from "next/link";

const primaryNav = [
  ["Home", "/"], ["Plan a Visit", "/plan-your-visit"], ["About", "/about"], ["Ministries", "/ministries"], ["Give", "/give"],
];
const secondaryNav = [
  ["What We Believe", "/what-we-believe"], ["Fellowships & Events", "/fellowships-events"], ["Contact", "/contact"],
];
const nav = [...primaryNav, ...secondaryNav];

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link className="brand" href="/" aria-label="Beulah Baptist Church home">
            <img src="/images/logo-wide.png" alt="" />
          </Link>
          <details className="mobile-menu"><summary aria-label="Open navigation">Menu</summary><nav>{nav.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</nav></details>
          <nav className="desktop-nav" aria-label="Main navigation">{primaryNav.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}<details className="more-menu"><summary>More <span>⌄</span></summary><div>{secondaryNav.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</div></details></nav>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div className="footer-brand"><div className="footer-mark"><img src="/images/logo-wide.png" alt="Beulah Baptist Church" /></div><p>Love God · Love People · Make Disciples</p></div>
          <div><h3>Visit</h3><p>5891 Lovelady Road<br />Dadeville, AL 36853<br /><a href="tel:+12568256515">256-825-6515</a></p><a href="https://www.google.com/maps/search/?api=1&query=5891+Lovelady+Road+Dadeville+AL+36853" target="_blank" rel="noreferrer">Get directions ↗</a></div>
          <div><h3>Gather</h3><p>Sunday Worship · 9:00 & 11:00 AM<br />Sunday School · 10:00 AM<br />Sunday & Wednesday Nights · 6:00 PM</p></div>
          <div><h3>Explore</h3>{nav.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</div>
        </div>
        <div className="wrap footer-bottom"><span>© {new Date().getFullYear()} Beulah Baptist Church</span><span>Southern Baptist · Tallapoosa Baptist Association</span></div>
      </footer>
    </>
  );
}
