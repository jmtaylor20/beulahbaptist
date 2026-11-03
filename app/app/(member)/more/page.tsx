import Link from "next/link";
import { base, requireMember } from "../../../../lib/members";
import { signOut } from "../../(auth)/actions";

export const metadata = { title: "More" };

export default async function More() {
  const person = await requireMember();
  const b = await base();
  const items: [string, string, string, string][] = [
    ["📖", "Daily reading", "A year through the Bible in your translation", "/devotion"],
    ["📣", "Announcements", "Everything the church has shared, plus suggest your own", "/announcements"],
    ["🙌", "Serving", "Sign up where help is needed", "/serving"],
    ["📝", "Forms", "Visitor card, membership, benevolence, facility use", "/forms"],
    ["💛", "Give", "Secure online giving through Tithe.ly", "/give"],
    ["👤", "Your profile", "Photo, contact details, what members can see", "/profile"],
  ];
  return (
    <>
      <h1>More</h1>
      <div className="ma-list">
        {items.map(([icon, title, sub, href]) => (
          <Link key={href} href={href === "/give" ? "/give" : `${b}${href}`} className="ma-row"><div className="ma-avatar">{icon}</div><div className="ma-row-text"><strong>{title}</strong><small>{sub}</small></div><span className="ma-chevron">›</span></Link>
        ))}
        {person.is_admin && <Link href={`${b}/admin`} className="ma-row"><div className="ma-avatar">⚙️</div><div className="ma-row-text"><strong>Admin portal</strong><small>Approve members, announcements, newsletter</small></div><span className="ma-chevron">›</span></Link>}
      </div>
      <form action={signOut} className="ma-actions" style={{ marginTop: 24 }}><button className="button quiet" type="submit">Sign out</button></form>
      <p className="ma-disclaimer">Everything in this app is shared only within the Beulah Baptist Church family. Please do not share member information outside the church.</p>
    </>
  );
}
