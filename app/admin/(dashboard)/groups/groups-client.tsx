"use client";

import { useState } from "react";

export interface GroupSummary {
  id: number;
  name: string;
  description: string;
  selfServe: boolean;
  smsCount: number;
  emailCount: number;
}

export function GroupsClient({ groups }: { groups: GroupSummary[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);

    const response = await fetch("/api/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        selfServe: form.get("selfServe") === "on",
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Could not create that group.");
      return;
    }
    window.location.reload();
  }

  async function toggleSelfServe(group: GroupSummary) {
    await fetch(`/api/admin/groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selfServe: !group.selfServe }),
    });
    window.location.reload();
  }

  async function remove(group: GroupSummary) {
    if (
      !window.confirm(
        `Delete the "${group.name}" group?\n\nThe people in it stay on the list — only the grouping is removed.`
      )
    ) {
      return;
    }
    await fetch(`/api/admin/groups/${group.id}`, { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="grid-2">
      <div className="card">
        <h3>Your groups</h3>
        {groups.length === 0 ? (
          <p style={{ color: "var(--muted)", marginBottom: 0 }}>
            No groups yet. Most churches start with one called &ldquo;Whole
            Church&rdquo;.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Phones</th>
                  <th>Emails</th>
                  <th>Signup form</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id}>
                    <td>
                      <strong>{group.name}</strong>
                      {group.description && (
                        <div
                          style={{
                            color: "var(--muted)",
                            fontSize: "0.8rem",
                          }}
                        >
                          {group.description}
                        </div>
                      )}
                    </td>
                    <td>{group.smsCount}</td>
                    <td>{group.emailCount}</td>
                    <td>
                      <button
                        className={`pill ${
                          group.selfServe ? "pill-ok" : "pill-off"
                        }`}
                        type="button"
                        style={{ border: 0, cursor: "pointer" }}
                        onClick={() => toggleSelfServe(group)}
                      >
                        {group.selfServe ? "Shown" : "Hidden"}
                      </button>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-danger"
                        type="button"
                        onClick={() => remove(group)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>New group</h3>
        {error && (
          <div className="notice notice-error">
            <p>{error}</p>
          </div>
        )}
        <form className="admin-form" onSubmit={create}>
          <label>
            Name
            <input type="text" name="name" required placeholder="Youth Parents" />
          </label>
          <label>
            Description
            <input
              type="text"
              name="description"
              placeholder="Trip details and pickup times"
            />
            <span className="hint">
              Shown on the public signup form when the group is visible there.
            </span>
          </label>
          <label className="inline-check">
            <input type="checkbox" name="selfServe" defaultChecked />
            <span>
              Let people choose this group when they sign up
              <span className="hint">
                Turn off for groups the office manages, like Deacons.
              </span>
            </span>
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create group"}
          </button>
        </form>
      </div>
    </div>
  );
}
