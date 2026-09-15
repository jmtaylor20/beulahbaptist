import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "../../../db";
import { broadcasts, groups, inboundMessages, members } from "../../../db/schema";
import { isEmailConfigured } from "../../../lib/email";
import { isMediaConfigured } from "../../../lib/media";
import { formatUsPhone } from "../../../lib/phone";
import { isTwilioConfigured } from "../../../lib/twilio";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const data = await loadDashboard();

  if (!data) {
    return (
      <>
        <h1>Dashboard</h1>
        <div className="notice notice-error">
          <p>
            The database isn&rsquo;t reachable yet. Deploy so the platform can
            apply the generated migration in <code>drizzle/</code>, then reload.
          </p>
        </div>
      </>
    );
  }

  const setupSteps = [
    { label: "Texting (Twilio)", done: isTwilioConfigured() },
    { label: "Email (Amazon SES)", done: isEmailConfigured() },
    { label: "Picture storage (R2)", done: isMediaConfigured() },
    { label: "At least one group", done: data.groupCount > 0 },
    { label: "Confirmed subscribers", done: data.smsConfirmed > 0 },
  ];
  const outstanding = setupSteps.filter((step) => !step.done);

  return (
    <>
      <h1>Dashboard</h1>
      <p className="admin-lede">
        Everything the church has sent, and who it can reach.
      </p>

      {outstanding.length > 0 && (
        <div className="notice notice-warn">
          <p>
            <strong>Setup isn&rsquo;t finished.</strong> Still to do:{" "}
            {outstanding.map((step) => step.label).join(", ")}. See{" "}
            <code>docs/messaging-setup.md</code> for the steps.
          </p>
        </div>
      )}

      <div className="stat-row">
        <div className="stat">
          <div className="value">{data.smsConfirmed}</div>
          <div className="label">Can be texted</div>
        </div>
        <div className="stat">
          <div className="value">{data.emailConfirmed}</div>
          <div className="label">Can be emailed</div>
        </div>
        <div className="stat">
          <div className="value">{data.pending}</div>
          <div className="label">Awaiting confirmation</div>
        </div>
        <div className="stat">
          <div className="value">{data.optedOut}</div>
          <div className="label">Opted out</div>
        </div>
        <div className="stat">
          <div className="value">${(data.spentThisMonth / 100).toFixed(2)}</div>
          <div className="label">Spent this month</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Recent messages</h3>
          {data.recent.length === 0 ? (
            <p style={{ color: "var(--muted)", marginBottom: 0 }}>
              Nothing sent yet.{" "}
              <Link href="/admin/compose" className="text-link">
                Write the first one
              </Link>
            </p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sent</th>
                    <th>Type</th>
                    <th>Message</th>
                    <th>To</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((row) => (
                    <tr key={row.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {formatDate(row.sentAt ?? row.createdAt)}
                      </td>
                      <td>
                        <span className="pill pill-off">
                          {row.channel === "email"
                            ? "Email"
                            : row.mediaId
                              ? "MMS"
                              : "SMS"}
                        </span>
                      </td>
                      <td>{truncate(row.subject || row.body, 70)}</td>
                      <td>{row.recipientCount}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        $
                        {(
                          (row.actualCostCents || row.estimatedCostCents) / 100
                        ).toFixed(2)}
                        {row.actualCostCents === 0 && (
                          <span
                            style={{
                              color: "var(--muted)",
                              fontSize: "0.72rem",
                            }}
                          >
                            {" "}
                            est
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Replies</h3>
          {data.replies.length === 0 ? (
            <p style={{ color: "var(--muted)", marginBottom: 0 }}>
              No replies yet. When members text back, their messages land here.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {data.replies.map((reply) => (
                <div
                  key={reply.id}
                  style={{
                    paddingBottom: 12,
                    borderBottom: "1px solid #eef1f5",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      fontSize: "0.78rem",
                      color: "var(--muted)",
                    }}
                  >
                    <strong style={{ color: "var(--navy)" }}>
                      {formatUsPhone(reply.fromPhone)}
                    </strong>
                    <span>{formatDate(reply.createdAt)}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: "0.88rem" }}>
                    {truncate(reply.body, 160)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

async function loadDashboard() {
  try {
    const db = getDb();

    const [counts] = await db
      .select({
        smsConfirmed: sql<number>`sum(case when ${members.smsStatus} = 'confirmed' then 1 else 0 end)`,
        emailConfirmed: sql<number>`sum(case when ${members.emailStatus} = 'confirmed' then 1 else 0 end)`,
        pending: sql<number>`sum(case when ${members.smsStatus} = 'pending' then 1 else 0 end)`,
        optedOut: sql<number>`sum(case when ${members.smsStatus} = 'opted_out' or ${members.emailStatus} = 'opted_out' then 1 else 0 end)`,
      })
      .from(members);

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [spend] = await db
      .select({
        total: sql<number>`coalesce(sum(case when ${broadcasts.actualCostCents} > 0 then ${broadcasts.actualCostCents} else ${broadcasts.estimatedCostCents} end), 0)`,
      })
      .from(broadcasts)
      .where(sql`${broadcasts.createdAt} >= ${monthStart.toISOString()}`);

    const [groupCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(groups);

    const recent = await db
      .select()
      .from(broadcasts)
      .orderBy(desc(broadcasts.id))
      .limit(8);

    const replies = await db
      .select()
      .from(inboundMessages)
      .where(sql`${inboundMessages.keyword} is null`)
      .orderBy(desc(inboundMessages.id))
      .limit(8);

    return {
      smsConfirmed: Number(counts?.smsConfirmed ?? 0),
      emailConfirmed: Number(counts?.emailConfirmed ?? 0),
      pending: Number(counts?.pending ?? 0),
      optedOut: Number(counts?.optedOut ?? 0),
      spentThisMonth: Number(spend?.total ?? 0),
      groupCount: Number(groupCount?.count ?? 0),
      recent,
      replies,
    };
  } catch (error) {
    console.error("[admin] dashboard load failed", error);
    return null;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncate(value: string, length: number): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}
