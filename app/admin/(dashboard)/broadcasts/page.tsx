import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { getDb } from "../../../../db";
import { broadcasts, deliveries, staff } from "../../../../db/schema";

export const metadata: Metadata = { title: "History" };
export const dynamic = "force-dynamic";

interface HistoryRow {
  id: number;
  channel: string;
  isMms: boolean;
  subject: string;
  body: string;
  sentAt: string;
  sentBy: string;
  recipientCount: number;
  estimatedCostCents: number;
  actualCostCents: number;
  delivered: number;
  failed: number;
  pending: number;
}

export default async function BroadcastHistory() {
  const rows = await loadHistory();

  if (!rows) {
    return (
      <>
        <h1>History</h1>
        <div className="notice notice-error">
          <p>
            The database isn&rsquo;t reachable yet. Deploy so the migration in{" "}
            <code>drizzle/</code> is applied, then reload.
          </p>
        </div>
      </>
    );
  }

  const totalSpent = rows.reduce(
    (sum, row) => sum + (row.actualCostCents || row.estimatedCostCents),
    0
  );

  return (
    <>
      <h1>History</h1>
      <p className="admin-lede">
        Every message the church has sent, what it reached, and what it cost.
      </p>

      <div className="stat-row">
        <div className="stat">
          <div className="value">{rows.length}</div>
          <div className="label">Messages sent</div>
        </div>
        <div className="stat">
          <div className="value">${(totalSpent / 100).toFixed(2)}</div>
          <div className="label">Total spend</div>
        </div>
        <div className="stat">
          <div className="value">
            {rows.reduce((sum, row) => sum + row.delivered, 0)}
          </div>
          <div className="label">Delivered</div>
        </div>
        <div className="stat">
          <div className="value">
            {rows.reduce((sum, row) => sum + row.failed, 0)}
          </div>
          <div className="label">Failed</div>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p style={{ color: "var(--muted)", marginBottom: 0 }}>
            Nothing sent yet.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Sent</th>
                  <th>Type</th>
                  <th>Message</th>
                  <th>Sent by</th>
                  <th>Delivered</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatDate(row.sentAt)}
                    </td>
                    <td>
                      <span className="pill pill-off">
                        {row.channel === "email"
                          ? "Email"
                          : row.isMms
                            ? "MMS"
                            : "SMS"}
                      </span>
                    </td>
                    <td style={{ maxWidth: 340 }}>
                      {row.subject && (
                        <strong style={{ display: "block" }}>
                          {row.subject}
                        </strong>
                      )}
                      <span style={{ color: "var(--muted)" }}>
                        {truncate(row.body, 110)}
                      </span>
                    </td>
                    <td>{row.sentBy}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {row.delivered}/{row.recipientCount}
                      {row.failed > 0 && (
                        <>
                          {" "}
                          <span className="pill pill-bad">
                            {row.failed} failed
                          </span>
                        </>
                      )}
                      {row.pending > 0 && (
                        <>
                          {" "}
                          <span className="pill pill-wait">
                            {row.pending} pending
                          </span>
                        </>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      $
                      {(
                        (row.actualCostCents || row.estimatedCostCents) / 100
                      ).toFixed(2)}
                      {row.actualCostCents === 0 && (
                        <span
                          style={{ color: "var(--muted)", fontSize: "0.72rem" }}
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
    </>
  );
}

async function loadHistory(): Promise<HistoryRow[] | null> {
  try {
    const db = getDb();

    const rows = await db
      .select({
        broadcast: broadcasts,
        sentByEmail: staff.email,
        sentByName: staff.name,
      })
      .from(broadcasts)
      .leftJoin(staff, eq(staff.id, broadcasts.createdBy))
      .orderBy(desc(broadcasts.id))
      .limit(100);

    // One grouped query for all broadcasts, rather than three per row.
    const statusRows = await db
      .select({
        broadcastId: deliveries.broadcastId,
        status: deliveries.status,
        count: sql<number>`count(*)`,
      })
      .from(deliveries)
      .groupBy(deliveries.broadcastId, deliveries.status);

    const stats = new Map<number, Record<string, number>>();
    for (const row of statusRows) {
      const entry = stats.get(row.broadcastId) ?? {};
      entry[row.status] = Number(row.count);
      stats.set(row.broadcastId, entry);
    }

    return rows.map(({ broadcast, sentByEmail, sentByName }) => {
      const counts = stats.get(broadcast.id) ?? {};
      return {
        id: broadcast.id,
        channel: broadcast.channel,
        isMms: Boolean(broadcast.mediaId),
        subject: broadcast.subject,
        body: broadcast.body,
        sentAt: broadcast.sentAt ?? broadcast.createdAt,
        sentBy: sentByName || sentByEmail || "—",
        recipientCount: broadcast.recipientCount,
        estimatedCostCents: broadcast.estimatedCostCents,
        actualCostCents: broadcast.actualCostCents,
        delivered: (counts.delivered ?? 0) + (counts.sent ?? 0),
        failed: (counts.failed ?? 0) + (counts.undelivered ?? 0),
        pending: counts.queued ?? 0,
      };
    });
  } catch (error) {
    console.error("[admin] history load failed", error);
    return null;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncate(value: string, length: number): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}
