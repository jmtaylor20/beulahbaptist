import Link from "next/link";

// Small shared pieces for the members app.

export function Avatar({ name, src, size = "" }: { name: string; src?: string | null; size?: "" | "lg" | "sm" }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return <div className={`ma-avatar ${size}`}>{src ? <img src={src} alt={name} /> : initials}</div>;
}

// Tap-to-call, tap-to-text, tap-to-email. Only renders the methods we have.
export function ContactButtons({ phone, email, light = false }: { phone?: string | null; email?: string | null; light?: boolean }) {
  if (!phone && !email) return null;
  const tel = phone?.replace(/[^\d+]/g, "");
  const cls = light ? "light" : "";
  return (
    <div className="ma-contact">
      {tel && <a className={cls} href={`tel:${tel}`}>📞 Call</a>}
      {tel && <a className={cls} href={`sms:${tel}`}>💬 Text</a>}
      {email && <a className={cls} href={`mailto:${email}`}>✉️ Email</a>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="ma-empty">{children}</div>;
}

export function Tabs({ items, current }: { items: [string, string, number?][]; current: string }) {
  return (
    <nav className="ma-tabs">
      {items.map(([label, href, count]) => (
        <Link key={href} href={href} className={href === current ? "is-active" : ""}>{label}{count ? <span className="ma-count">{count}</span> : null}</Link>
      ))}
    </nav>
  );
}

export function Notice({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  if (searchParams.error) return <p className="ma-error">{searchParams.error}</p>;
  if (searchParams.ok) return <p className="ma-ok">{searchParams.ok}</p>;
  return null;
}
