import Link from "next/link";
import { base, fullName, photoUrl, requireAdmin } from "../../../../lib/members";
import { supabaseServer } from "../../../../lib/supabase/server";
import { Avatar } from "../../ui";
import { AdminNav } from "./AdminNav";

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const person = await requireAdmin();
  const b = await base();
  const supabase = await supabaseServer();
  const [pending, suggestedA, suggestedE, forms] = await Promise.all([
    supabase.from("people").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("announcements").select("id", { count: "exact", head: true }).eq("status", "suggested"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "suggested"),
    supabase.from("form_submissions").select("id", { count: "exact", head: true }).is("handled_at", null),
  ]);
  const counts = { people: pending.count ?? 0, announcements: suggestedA.count ?? 0, events: suggestedE.count ?? 0, forms: forms.count ?? 0 };
  return (
    <div className="ma">
      <header className="ma-top">
        <img src="/images/logo-seal.png" alt="" />
        <Link href={`${b}/admin`} className="ma-title"><strong>Admin portal</strong><small>Beulah Baptist</small></Link>
        <span className="ma-spacer" />
        <Link href={b || "/"} className="button small quiet ma-top-link">Member view</Link>
        <Link href={`${b}/profile`} className="ma-me" aria-label="Your profile"><Avatar name={fullName(person)} src={await photoUrl(person.photo_path)} size="sm" /></Link>
      </header>
      <div className="ma-shell">
        <AdminNav base={b} counts={counts} />
        <main className="ma-main">{children}</main>
      </div>
    </div>
  );
}
