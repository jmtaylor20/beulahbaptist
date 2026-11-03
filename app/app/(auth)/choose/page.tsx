import Link from "next/link";
import { redirect } from "next/navigation";
import { base, currentPerson } from "../../../../lib/members";

export const metadata = { title: "Where to?" };

// Admins land here after sign-in and pick a side. Both are always reachable
// from inside the app too (the Admin tab and the Member view button).
export default async function Choose() {
  const b = await base();
  const person = await currentPerson();
  if (!person || person.status !== "active") redirect(`${b}/login`);
  if (!person.is_admin) redirect(b || "/");
  return (
    <div className="ma-auth">
      <div className="ma-auth-card">
        <img src="/images/logo-seal.png" alt="" />
        <h1>Welcome, {person.first_name}</h1>
        <p className="ma-lead">You have admin access. Where would you like to go?</p>
        <div className="ma-grid" style={{ marginTop: 18 }}>
          <Link className="ma-tile" href={b || "/"}><span>👥</span><strong>Member app</strong><small>Directory, prayer, calendar, your family</small></Link>
          <Link className="ma-tile" href={`${b}/admin`}><span>⚙️</span><strong>Admin portal</strong><small>Approvals, announcements, weekly email</small></Link>
        </div>
      </div>
    </div>
  );
}
