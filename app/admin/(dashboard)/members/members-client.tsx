"use client";

import { useMemo, useState } from "react";

export interface MemberRow {
  id: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  phoneDisplay: string;
  email: string | null;
  smsStatus: string;
  emailStatus: string;
  groupNames: string[];
}

export interface GroupRow {
  id: number;
  name: string;
}

const SMS_LABELS: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Subscribed", className: "pill-ok" },
  pending: { label: "Pending", className: "pill-wait" },
  opted_out: { label: "Opted out", className: "pill-bad" },
  undeliverable: { label: "Bad number", className: "pill-bad" },
  none: { label: "No texts", className: "pill-off" },
};

export function MembersClient({
  members,
  groups,
}: {
  members: MemberRow[];
  groups: GroupRow[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (filter !== "all" && member.smsStatus !== filter) return false;
      if (!needle) return true;
      return [
        member.firstName,
        member.lastName,
        member.phoneDisplay,
        member.email ?? "",
        ...member.groupNames,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [members, query, filter]);

  return (
    <>
      <div
        className="btn-row"
        style={{ marginBottom: 18, justifyContent: "space-between" }}
      >
        <div className="btn-row">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setShowAdd((open) => !open);
              setShowImport(false);
            }}
          >
            Add a person
          </button>
          <button
            className="btn btn-quiet"
            type="button"
            onClick={() => {
              setShowImport((open) => !open);
              setShowAdd(false);
            }}
          >
            Import a CSV
          </button>
        </div>
        <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
          {visible.length} of {members.length} shown
        </span>
      </div>

      {showAdd && <AddMemberForm groups={groups} />}
      {showImport && <ImportForm />}

      <div className="card">
        <div
          className="admin-form"
          style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
        >
          <label style={{ flex: "1 1 240px", margin: 0 }}>
            Search
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, number, email, or group"
            />
          </label>
          <label style={{ flex: "0 1 200px", margin: 0 }}>
            Text status
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">Everyone</option>
              <option value="confirmed">Subscribed</option>
              <option value="pending">Pending</option>
              <option value="opted_out">Opted out</option>
              <option value="undeliverable">Bad number</option>
              <option value="none">No texts</option>
            </select>
          </label>
        </div>

        <div className="table-scroll" style={{ marginTop: 18 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Texts</th>
                <th>Groups</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: "var(--muted)" }}>
                    {members.length === 0
                      ? "Nobody on the list yet. Add someone, or import your Flocknote export."
                      : "No one matches that search."}
                  </td>
                </tr>
              )}
              {visible.map((member) => {
                const status =
                  SMS_LABELS[member.smsStatus] ?? SMS_LABELS.none;
                return (
                  <tr key={member.id}>
                    <td>
                      <strong>
                        {`${member.firstName} ${member.lastName}`.trim() ||
                          "(no name)"}
                      </strong>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {member.phoneDisplay || "—"}
                    </td>
                    <td>{member.email || "—"}</td>
                    <td>
                      <span className={`pill ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td>{member.groupNames.join(", ") || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <MemberActions member={member} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function MemberActions({ member }: { member: MemberRow }) {
  const [busy, setBusy] = useState(false);

  async function unsubscribe() {
    if (
      !window.confirm(
        `Stop sending texts to ${member.firstName || "this person"}?`
      )
    ) {
      return;
    }
    setBusy(true);
    await fetch(`/api/admin/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unsubscribeSms: true }),
    });
    window.location.reload();
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete ${member.firstName || "this person"} from the list entirely?\n\n` +
          `Their opt-out record is kept, so a future import can't re-add them by mistake.`
      )
    ) {
      return;
    }
    setBusy(true);
    await fetch(`/api/admin/members/${member.id}`, { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="btn-row" style={{ justifyContent: "flex-end" }}>
      {member.smsStatus === "confirmed" && (
        <button
          className="btn btn-quiet"
          type="button"
          disabled={busy}
          onClick={unsubscribe}
        >
          Unsubscribe
        </button>
      )}
      <button
        className="btn btn-danger"
        type="button"
        disabled={busy}
        onClick={remove}
      >
        Delete
      </button>
    </div>
  );
}

function AddMemberForm({ groups }: { groups: GroupRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h3>Add a person</h3>
      {error && (
        <div className="notice notice-error">
          <p>{error}</p>
        </div>
      )}
      <form
        className="admin-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);

          const form = new FormData(event.currentTarget);
          const response = await fetch("/api/admin/members", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              firstName: form.get("firstName"),
              lastName: form.get("lastName"),
              phone: form.get("phone"),
              email: form.get("email"),
              consentNote: form.get("consentNote"),
              subscribeSms: form.get("subscribeSms") === "on",
              groupIds: form.getAll("groupIds").map(Number),
            }),
          });
          const payload = (await response.json()) as { error?: string };
          setBusy(false);

          if (!response.ok) {
            setError(payload.error ?? "Could not add that person.");
            return;
          }
          window.location.reload();
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 180px" }}>
            First name
            <input type="text" name="firstName" required />
          </label>
          <label style={{ flex: "1 1 180px" }}>
            Last name
            <input type="text" name="lastName" />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 180px" }}>
            Mobile number
            <input type="tel" name="phone" placeholder="(256) 555-0134" />
          </label>
          <label style={{ flex: "1 1 180px" }}>
            Email
            <input type="email" name="email" />
          </label>
        </div>

        {groups.length > 0 && (
          <label>
            Groups
            <div className="checkbox-list">
              {groups.map((group) => (
                <label key={group.id}>
                  <input type="checkbox" name="groupIds" value={group.id} />
                  <span>{group.name}</span>
                </label>
              ))}
            </div>
          </label>
        )}

        <label className="inline-check">
          <input type="checkbox" name="subscribeSms" defaultChecked />
          <span>Subscribe them to text messages</span>
        </label>

        <label style={{ marginTop: 14 }}>
          How did they give permission?
          <input
            type="text"
            name="consentNote"
            placeholder="Signed a connection card on 8/24"
          />
          <span className="hint">
            Required when subscribing to texts. This is the church&rsquo;s
            record that they asked to be added.
          </span>
        </label>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add person"}
        </button>
      </form>
    </div>
  );
}

interface ImportSummary {
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: Array<{ rowNumber: number; name: string; reason: string }>;
  skippedCount: number;
}

function ImportForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function run(event: React.FormEvent<HTMLFormElement>, dryRun: boolean) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("dryRun", String(dryRun));
    form.set("smsConsent", form.get("smsConsent") === "on" ? "true" : "false");

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/members/import", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as ImportSummary & {
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "The import failed.");
        return;
      }
      setSummary(payload);
      if (!dryRun) setTimeout(() => window.location.reload(), 2500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h3>Import a CSV</h3>
      <p style={{ color: "var(--muted)", fontSize: "0.86rem" }}>
        Export your contacts from Flocknote and upload the file. Columns named
        First Name, Last Name, Phone, Email, and Groups are matched
        automatically. Check it first &mdash; the preview reports what would
        happen without changing anything.
      </p>

      {error && (
        <div className="notice notice-error">
          <p>{error}</p>
        </div>
      )}

      {summary && (
        <div
          className={`notice ${summary.dryRun ? "notice-info" : "notice-ok"}`}
        >
          <p>
            <strong>
              {summary.dryRun ? "Preview:" : "Imported."}
            </strong>{" "}
            {summary.total} rows read, {summary.created}{" "}
            {summary.dryRun ? "would be added" : "added"}
            {summary.updated > 0 && `, ${summary.updated} updated`}
            {summary.skippedCount > 0 && `, ${summary.skippedCount} skipped`}.
          </p>
          {summary.skipped.length > 0 && (
            <ul style={{ margin: "8px 0 0 18px", fontSize: "0.82rem" }}>
              {summary.skipped.slice(0, 10).map((row) => (
                <li key={row.rowNumber}>
                  Row {row.rowNumber} ({row.name}): {row.reason}
                </li>
              ))}
              {summary.skippedCount > 10 && (
                <li>…and {summary.skippedCount - 10} more.</li>
              )}
            </ul>
          )}
        </div>
      )}

      <form className="admin-form" onSubmit={(event) => run(event, false)}>
        <label>
          CSV file
          <input type="file" name="file" accept=".csv,text/csv" required />
        </label>

        <label className="inline-check">
          <input type="checkbox" name="smsConsent" />
          <span>
            These people already agreed to receive texts on our previous
            platform
            <span className="hint">
              Only tick this if it is true. It marks everyone in the file as
              subscribed and records that you attested to their prior consent.
              Anyone who already opted out here stays opted out.
            </span>
          </span>
        </label>

        <label style={{ marginTop: 14 }}>
          Note for the record
          <input
            type="text"
            name="sourceNote"
            placeholder="Flocknote export, 8/28/2026"
          />
        </label>

        <div className="btn-row">
          <button
            className="btn btn-quiet"
            type="submit"
            disabled={busy}
            formNoValidate
            onClick={(event) => {
              event.preventDefault();
              const form = event.currentTarget.form;
              if (form?.reportValidity()) {
                void run(
                  { preventDefault: () => {}, currentTarget: form } as unknown as React.FormEvent<HTMLFormElement>,
                  true
                );
              }
            }}
          >
            {busy ? "Checking…" : "Check the file first"}
          </button>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Importing…" : "Import for real"}
          </button>
        </div>
      </form>
    </div>
  );
}
