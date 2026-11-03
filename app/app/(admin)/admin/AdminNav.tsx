"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ base, counts }: { base: string; counts: Record<string, number> }) {
  const path = usePathname();
  const items: [string, string, string, number][] = [
    ["Queue", "/admin", "📥", counts.people + counts.announcements + counts.events + counts.forms],
    ["People", "/admin/people", "👥", counts.people],
    ["Announce", "/admin/announcements", "📣", counts.announcements],
    ["Events", "/admin/events", "📅", counts.events],
    ["Newsletter", "/admin/newsletter", "✉️", 0],
    ["Forms", "/admin/forms", "📝", counts.forms],
  ];
  const rel = base && path.startsWith(base) ? path.slice(base.length) : path;
  return (
    <nav className="ma-nav" style={{ gridTemplateColumns: "repeat(6,1fr)" }} aria-label="Admin navigation">
      {items.map(([label, href, icon, count]) => (
        <Link key={href} href={`${base}${href}`} className={(href === "/admin" ? rel === "/admin" : rel.startsWith(href)) ? "is-active" : ""}>
          <span aria-hidden>{icon}</span>{label}{count ? <span className="ma-count">{count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
