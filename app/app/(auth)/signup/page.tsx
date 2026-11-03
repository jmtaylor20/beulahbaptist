import Link from "next/link";
import { base } from "../../../../lib/members";
import { requestAccess } from "../actions";

export const metadata = { title: "Request access" };

export default async function Signup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const b = await base();
  const { error } = await searchParams;
  return (
    <div className="ma-auth">
      <div className="ma-auth-card">
        <img src="/images/logo-seal.png" alt="" />
        <h1>Request access</h1>
        <p className="ma-lead">The members app is for the Beulah church family. Tell us who you are and the church office will approve your account.</p>
        <form className="ma-form" action={requestAccess}>
          {error && <p className="ma-error">{error}</p>}
          <div className="row">
            <label>First name<input name="first_name" autoComplete="given-name" required /></label>
            <label>Last name<input name="last_name" autoComplete="family-name" required /></label>
          </div>
          <label>Email<input name="email" type="email" autoComplete="email" inputMode="email" required /></label>
          <label>Phone<input name="phone" type="tel" autoComplete="tel" inputMode="tel" /></label>
          <label>Choose a password<input name="password" type="password" autoComplete="new-password" minLength={8} required /><span className="hint">At least 8 characters.</span></label>
          <label>Anything the office should know?<textarea name="request_note" rows={2} placeholder="Family members, Sunday school class, how long you have attended" /></label>
          <button className="button gold" type="submit">Send request</button>
          <p className="alt">Already approved? <Link href={`${b}/login`}>Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
