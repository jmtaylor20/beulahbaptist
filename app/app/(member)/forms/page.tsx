import { requireMember } from "../../../../lib/members";
import { Notice } from "../../ui";
import { submitForm } from "../actions";

export const metadata = { title: "Forms" };

const FORMS: { kind: string; title: string; blurb: string; fields: [string, string, "text" | "textarea" | "date" | "tel" | "email" | "number"][] }[] = [
  { kind: "visitor", title: "Visitor card", blurb: "Bringing a guest, or filling this in for someone who visited? Tell us about them.", fields: [["guest_name", "Guest's name", "text"], ["guest_phone", "Guest's phone", "tel"], ["guest_email", "Guest's email", "email"], ["visited_on", "Date they visited", "date"], ["notes", "Anything we should know", "textarea"]] },
  { kind: "membership", title: "Membership request", blurb: "Ready to join Beulah? The pastor will follow up with you.", fields: [["how", "How would you like to join (baptism, letter, statement of faith)", "text"], ["previous_church", "Previous church, if any", "text"], ["story", "Tell us a little of your story", "textarea"]] },
  { kind: "benevolence", title: "Benevolence request", blurb: "Confidential. Goes only to the pastor and the benevolence team.", fields: [["need", "What is the need", "textarea"], ["amount", "Approximate amount, if money", "number"], ["timing", "When is it needed by", "date"], ["contact", "Best way to reach you", "text"]] },
  { kind: "facility", title: "Facility reservation", blurb: "Reserve the fellowship hall, sanctuary or grounds.", fields: [["space", "Which space", "text"], ["date", "Date", "date"], ["times", "Start and end time", "text"], ["purpose", "Purpose", "textarea"], ["headcount", "Expected attendance", "number"]] },
];

export default async function Forms({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireMember();
  const sp = await searchParams;
  return (
    <>
      <h1>Forms</h1>
      <p className="ma-lead">Each form goes straight to the church office with your name attached.</p>
      <Notice searchParams={sp} />
      {FORMS.map((f) => (
        <details key={f.kind} className="ma-card">
          <summary style={{ cursor: "pointer", fontWeight: 800, color: "var(--navy)" }}>{f.title}</summary>
          <p className="ma-lead" style={{ marginTop: 10 }}>{f.blurb}</p>
          <form className="ma-form" action={submitForm}>
            <input type="hidden" name="kind" value={f.kind} />
            {f.fields.map(([name, label, type]) => (
              <label key={name}>{label}{type === "textarea" ? <textarea name={name} rows={3} /> : <input name={name} type={type} />}</label>
            ))}
            <button className="button navy" type="submit">Send {f.title.toLowerCase()}</button>
          </form>
        </details>
      ))}
    </>
  );
}
