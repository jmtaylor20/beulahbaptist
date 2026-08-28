"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export interface SelfServeGroup {
  id: number;
  name: string;
  description: string;
}

type Stage = "details" | "code" | "done";

export function SignupForm({
  groups,
  churchName,
}: {
  groups: SelfServeGroup[];
  churchName: string;
}) {
  const [stage, setStage] = useState<Stage>("details");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");

  const toggleGroup = (id: number) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );

  async function submitDetails(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          email,
          groupIds: selected,
          consent,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStage("code");
    } catch {
      setError("We couldn't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStage("done");
    } catch {
      setError("We couldn't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "done") {
    return (
      <div className="signup-card">
        <p className="eyebrow">You&rsquo;re all set</p>
        <h2 style={{ fontSize: "1.9rem" }}>Welcome aboard.</h2>
        <p>
          You&rsquo;ll now get text updates from {churchName}. You can reply{" "}
          <strong>STOP</strong> to any message to stop them at any time.
        </p>
        <p style={{ marginBottom: 0 }}>
          <Link className="text-link" href="/">
            Back to the church home page <span>&rarr;</span>
          </Link>
        </p>
      </div>
    );
  }

  if (stage === "code") {
    return (
      <div className="signup-card">
        <p className="eyebrow">One more step</p>
        <h2 style={{ fontSize: "1.9rem" }}>Check your phone.</h2>
        <p>
          We texted a 6-digit code to <strong>{phone}</strong>. Enter it below
          to finish signing up.
        </p>

        {error && (
          <div className="notice notice-error">
            <p>{error}</p>
          </div>
        )}

        <form className="admin-form" onSubmit={submitCode}>
          <label>
            Verification code
            <input
              className="code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, ""))
              }
            />
          </label>
          <div className="btn-row">
            <button
              className="btn btn-gold"
              type="submit"
              disabled={busy || code.length !== 6}
            >
              {busy ? "Checking…" : "Confirm"}
            </button>
            <button
              className="btn btn-quiet"
              type="button"
              disabled={busy}
              onClick={() => {
                setStage("details");
                setCode("");
                setError(null);
              }}
            >
              Change number
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="signup-card">
      <p className="eyebrow">Text updates</p>
      <h2 style={{ fontSize: "1.9rem" }}>Stay in the loop.</h2>
      <p>
        Get service changes, prayer needs, and event reminders by text. We keep
        it to what matters, and you can stop any time.
      </p>

      {error && (
        <div className="notice notice-error">
          <p>{error}</p>
        </div>
      )}

      <form className="admin-form" onSubmit={submitDetails}>
        <label>
          First name
          <input
            type="text"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </label>
        <label>
          Last name
          <input
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </label>
        <label>
          Mobile number
          <input
            type="tel"
            required
            autoComplete="tel"
            placeholder="(256) 555-0134"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <span className="hint">
            Must be a mobile number that can receive texts.
          </span>
        </label>
        <label>
          Email <span style={{ opacity: 0.6 }}>(optional)</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <span className="hint">
            Add it and you&rsquo;ll also get the church newsletter.
          </span>
        </label>

        {groups.length > 0 && (
          <label>
            What would you like to hear about?
            <div className="checkbox-list">
              {groups.map((group) => (
                <label key={group.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(group.id)}
                    onChange={() => toggleGroup(group.id)}
                  />
                  <span>
                    <strong>{group.name}</strong>
                    {group.description ? (
                      <>
                        <br />
                        <span style={{ color: "var(--muted)" }}>
                          {group.description}
                        </span>
                      </>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </label>
        )}

        <div className="consent-box">
          <label
            className="inline-check"
            style={{ border: 0, padding: 0, background: "transparent" }}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
            />
            <span>
              I agree to receive text messages from {churchName} at the number
              provided. Message frequency varies. Msg &amp; data rates may
              apply. Reply STOP to opt out, HELP for help.
            </span>
          </label>
        </div>

        <button
          className="btn btn-gold"
          type="submit"
          disabled={busy || !consent}
        >
          {busy ? "Sending code…" : "Send me a verification code"}
        </button>
      </form>
    </div>
  );
}
