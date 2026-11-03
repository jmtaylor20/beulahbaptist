import Link from "next/link";
import { base, fullName, photoUrl, requireMember } from "../../../lib/members";
import { Avatar } from "../ui";
import { NavLinks } from "./NavLinks";

export default async function MemberShell({ children }: { children: React.ReactNode }) {
  const person = await requireMember();
  const b = await base();
  const photo = await photoUrl(person.photo_path);
  return (
    <div className="ma">
      <header className="ma-top">
        <img src="/images/logo-seal.png" alt="" />
        <Link href={b || "/"} className="ma-title"><strong>Beulah Baptist</strong><small>Church family</small></Link>
        <span className="ma-spacer" />
        <Link href={`${b}/profile`} className="ma-me" aria-label="Your profile"><Avatar name={fullName(person)} src={photo} size="sm" /></Link>
      </header>
      <div className="ma-shell">
        <NavLinks base={b} isAdmin={person.is_admin} />
        <main className="ma-main">{children}</main>
      </div>
    </div>
  );
}
