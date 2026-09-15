import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getStaffBySessionToken } from "../../../lib/auth";
import "../admin.css";

export const metadata: Metadata = {
  title: { default: "Messaging", template: "%s | Church Messaging" },
  // The admin area must never end up in search results.
  robots: { index: false, follow: false, nocache: true },
};

// Every page in this group depends on the session cookie.
export const dynamic = "force-dynamic";

const NAV: Array<[string, string]> = [
  ["Dashboard", "/admin"],
  ["Compose", "/admin/compose"],
  ["People", "/admin/members"],
  ["Groups", "/admin/groups"],
  ["History", "/admin/broadcasts"],
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/admin/signin");

  return (
    <div className="admin-shell">
      <div className="admin-bar">
        <div className="wrap admin-bar-inner">
          <Link href="/admin" className="admin-brand">
            Beulah Baptist
            <small>Messaging</small>
          </Link>
          <nav className="admin-nav">
            {NAV.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="admin-user">
            <span>{user.name || user.email}</span>
            <form action="/api/auth/signout" method="post">
              <button type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </div>
      <main className="admin-main">
        <div className="wrap">{children}</div>
      </main>
    </div>
  );
}

/**
 * A fresh deploy may not have had its migration applied yet. Treating a
 * database error as "signed out" sends the operator to the sign-in page
 * instead of a stack trace.
 */
async function currentUser() {
  try {
    const store = await cookies();
    return await getStaffBySessionToken(
      store.get(SESSION_COOKIE)?.value ?? null
    );
  } catch (error) {
    console.error("[admin] session lookup failed", error);
    return null;
  }
}
