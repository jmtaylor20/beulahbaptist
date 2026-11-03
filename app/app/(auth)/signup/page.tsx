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
        <p className="ma-lead">One login per family. Sign up once for your household; after the church office approves you, add your spouse and children from your profile. Everyone in your family with an email on file gets the weekly email.</p>
        <form className="ma-form" action={requestAccess}>
          {error && <p className="ma-error">{error}</p>}
          <div className="row">
            <label>Your first name<input name="first_name" autoComplete="given-name" required /></label>
            <label>Last name<input name="last_name" autoComplete="family-name" required /></label>
          </div>
          <label>Family name in the directory<input name="family_name" placeholder="The Taylor Family" /><span className="hint">Leave blank to use your last name.</span></label>
          <label>Email<input name="email" type="email" autoComplete="email" inputMode="email" required /><span className="hint">This is the login for your whole family.</span></label>
          <label>Mobile phone<input name="phone" type="tel" autoComplete="tel" inputMode="tel" /></label>
          <label>Choose a password<input name="password" type="password" autoComplete="new-password" minLength={8} required /><span className="hint">At least 8 characters. Share it with your spouse.</span></label>
          <label>Anything the office should know?<textarea name="request_note" rows={2} placeholder="Family members, Sunday school class, how long you have attended" /></label>
          <button className="button gold" type="submit">Send request</button>
          <p className="alt">Already approved? <Link href={`${b}/login`}>Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
