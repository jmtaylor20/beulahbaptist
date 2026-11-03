import Link from "next/link";
import { base } from "../../../../lib/members";
import { sendReset } from "../actions";

export const metadata = { title: "Reset password" };

export default async function Forgot() {
  const b = await base();
  return (
    <div className="ma-auth">
      <div className="ma-auth-card">
        <img src="/images/logo-seal.png" alt="" />
        <h1>Reset password</h1>
        <p className="ma-lead">Enter your email and we will send a link to choose a new password.</p>
        <form className="ma-form" action={sendReset}>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <button className="button navy" type="submit">Send reset link</button>
          <p className="alt"><Link href={`${b}/login`}>Back to sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
