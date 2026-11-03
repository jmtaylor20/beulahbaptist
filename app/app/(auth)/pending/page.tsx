import { redirect } from "next/navigation";
import { base, currentPerson } from "../../../../lib/members";
import { ensurePerson, signOut } from "../actions";

export const metadata = { title: "Request received" };

export default async function Pending() {
  const b = await base();
  await ensurePerson();
  const person = await currentPerson();
  if (person?.status === "active") redirect(b || "/");
  const declined = person?.status === "declined";
  return (
    <div className="ma-auth">
      <div className="ma-auth-card">
        <img src="/images/logo-seal.png" alt="" />
        <h1>{declined ? "Request not approved" : "Request received"}</h1>
        {!person ? (
          <p className="ma-lead">Check your email for a confirmation link, then sign in. Your request goes to the church office once your email is confirmed.</p>
        ) : declined ? (
          <p className="ma-lead">The church office was not able to approve this account. If you think that is a mistake, call the church at 256-825-6515.</p>
        ) : (
          <p className="ma-lead">Thank you, {person.first_name}. The church office will review your request and you will get an email when your account is ready. This usually takes a day or two.</p>
        )}
        <form action={signOut} className="ma-actions" style={{ justifyContent: "center" }}><button className="button quiet" type="submit">Sign out</button></form>
      </div>
    </div>
  );
}
