import Link from "next/link";
import { redirect } from "next/navigation";
import { base, currentPerson } from "../../../../lib/members";
import { supabaseConfigured } from "../../../../lib/supabase/server";
import { signIn } from "../actions";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const b = await base();
  if (supabaseConfigured() && (await currentPerson())) redirect(b || "/");
  const { error, ok } = await searchParams;
  return (
    <div className="ma-auth">
      <div className="ma-auth-card">
        <img src="/images/logo-seal.png" alt="" />
        <h1>Beulah Members</h1>
        <p className="ma-lead">Directory, prayer, calendar and announcements for our church family.</p>
        {!supabaseConfigured() ? <p className="ma-error">The members app is not connected yet.</p> : (
          <form className="ma-form" action={signIn}>
            {error && <p className="ma-error">{error}</p>}
            {ok && <p className="ma-ok">{ok}</p>}
            <label>Email<input name="email" type="email" autoComplete="email" inputMode="email" required /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
            <button className="button navy" type="submit">Sign in</button>
            <p className="alt"><Link href={`${b}/forgot`}>Forgot your password?</Link></p>
            <p className="alt">New here? <Link href={`${b}/signup`}>Request access</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}
