"use client";
import { FormEvent, useState } from "react";

export function ContactForm({ kind = "contact", compact = false }: { kind?: "contact" | "prayer" | "visitor"; compact?: boolean }) {
  const [sent, setSent] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSent(true); };
  if (sent) return <div className={`form-success ${compact ? "compact" : ""}`}><strong>Thank you for reaching out.</strong><p>Your message has been received in this preview. The church’s delivery address will be connected before public launch.</p><button onClick={() => setSent(false)}>Send another</button></div>;
  return (
    <form className={`church-form ${compact ? "compact" : ""}`} onSubmit={submit}>
      <div className="field-row"><label>Name<input name="name" autoComplete="name" required /></label><label>Email<input name="email" type="email" autoComplete="email" required /></label></div>
      {kind === "visitor" && <div className="field-row"><label>Phone<input name="phone" type="tel" autoComplete="tel" /></label><label>Who’s coming?<input name="party" placeholder="Adults and children" /></label></div>}
      {kind === "contact" && <label>Subject<select name="subject"><option>General question</option><option>Ministry information</option><option>Plan a visit</option><option>Giving</option></select></label>}
      <label>{kind === "prayer" ? "Prayer request" : kind === "visitor" ? "Anything we can help with?" : "Message"}<textarea name="message" rows={compact ? 3 : 6} required /></label>
      {kind === "prayer" && <label className="check"><input type="checkbox" name="private" /> Keep this request private to church leadership</label>}
      <button className="button gold" type="submit">{kind === "prayer" ? "Share prayer request" : kind === "visitor" ? "Let us know you’re coming" : "Send message"}</button>
    </form>
  );
}
