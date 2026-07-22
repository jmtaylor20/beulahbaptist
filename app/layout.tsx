import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const base = new URL(`${host.includes("localhost") ? "http" : "https"}://${host}`);
  return {
    metadataBase: base,
    title: { default: "Beulah Baptist Church", template: "%s | Beulah Baptist Church" },
    description: "Beulah Baptist Church in Dadeville, Alabama — a Southern Baptist church and member of the Tallapoosa Baptist Association.",
    icons: { icon: "/images/logo-seal.png", shortcut: "/images/logo-seal.png" },
    openGraph: { title: "Beulah Baptist Church", description: "Faith · Family · Fellowship in Dadeville, Alabama", type: "website", images: [{ url: new URL("/og.png", base).toString(), width: 1200, height: 630, alt: "Beulah Baptist Church" }] },
    twitter: { card: "summary_large_image", title: "Beulah Baptist Church", description: "Faith · Family · Fellowship in Dadeville, Alabama", images: [new URL("/og.png", base).toString()] },
  };
}

const nav = [
  ["Home", "/"], ["Plan Your Visit", "/plan-your-visit"], ["About Us", "/about"], ["Ministries", "/ministries"],
  ["What We Believe", "/what-we-believe"], ["Fellowships & Events", "/fellowships-events"], ["Give", "/give"], ["Contact", "/contact"],
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="wrap header-inner">
            <Link className="brand" href="/" aria-label="Beulah Baptist Church home">
              <img src="/images/logo-seal.png" alt="" />
              <span><strong>Beulah</strong><small>Baptist Church</small></span>
            </Link>
            <details className="mobile-menu"><summary aria-label="Open navigation">Menu</summary><nav>{nav.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</nav></details>
            <nav className="desktop-nav" aria-label="Main navigation">{nav.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="wrap footer-grid">
            <div className="footer-brand"><div className="footer-mark"><img src="/images/logo-seal.png" alt="" /><span><strong>Beulah</strong><small>Baptist Church</small></span></div><p>Love God · Love People · Make Disciples</p></div>
            <div><h3>Visit</h3><p>5891 Lovelady Road<br />Dadeville, AL 36853<br /><a href="tel:+12568256515">256-825-6515</a></p><a href="https://www.google.com/maps/search/?api=1&query=5891+Lovelady+Road+Dadeville+AL+36853" target="_blank" rel="noreferrer">Get directions ↗</a></div>
            <div><h3>Gather</h3><p>Sunday Worship · 9:00 & 11:00 AM<br />Sunday School · 10:00 AM<br />Sunday & Wednesday Nights · 6:00 PM</p></div>
            <div><h3>Explore</h3>{nav.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</div>
          </div>
          <div className="wrap footer-bottom"><span>© {new Date().getFullYear()} Beulah Baptist Church</span><span>Southern Baptist · Tallapoosa Baptist Association</span></div>
        </footer>
      </body>
    </html>
  );
}
