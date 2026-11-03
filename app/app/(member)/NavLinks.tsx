"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links: [string, string, string][] = [
  ["Home", "", "🏠"], ["Directory", "/directory", "👥"], ["Prayer", "/prayer", "🙏"], ["Calendar", "/calendar", "📅"], ["More", "/more", "☰"],
];

export function NavLinks({ base, isAdmin }: { base: string; isAdmin: boolean }) {
  const path = usePathname();
  const rel = base && path.startsWith(base) ? path.slice(base.length) : path;
  const active = (href: string) => (href === "" ? rel === "" || rel === "/" : rel.startsWith(href));
  const items = isAdmin ? [...links.slice(0, 4), ["Admin", "/admin", "⚙️"] as [string, string, string], links[4]] : links;
  return (
    <nav className="ma-nav" style={isAdmin ? { gridTemplateColumns: "repeat(6,1fr)" } : undefined} aria-label="App navigation">
      {items.map(([label, href, icon]) => (
        <Link key={href} href={`${base}${href || "/"}`} className={`${active(href) ? "is-active" : ""} ${href === "/admin" ? "is-admin" : ""}`}><span aria-hidden>{icon}</span>{label}</Link>
      ))}
    </nav>
  );
}
