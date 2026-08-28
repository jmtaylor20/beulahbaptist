import type { Metadata } from "next";
import { getBaseUrl } from "../../../../lib/config";
import { groupReachCounts, listGroups } from "../../../../lib/members";
import { GroupsClient, type GroupSummary } from "./groups-client";

export const metadata: Metadata = { title: "Groups" };
export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const data = await loadGroups();

  if (!data) {
    return (
      <>
        <h1>Groups</h1>
        <div className="notice notice-error">
          <p>
            The database isn&rsquo;t reachable yet. Deploy so the migration in{" "}
            <code>drizzle/</code> is applied, then reload.
          </p>
        </div>
      </>
    );
  }

  const signupUrl = `${getBaseUrl()}/text`;

  return (
    <>
      <h1>Groups</h1>
      <p className="admin-lede">
        Groups decide who gets what. A member can be in as many as you like, and
        will only ever get one copy of a message.
      </p>

      <div className="notice notice-info">
        <p>
          Members sign themselves up at <strong>{signupUrl}</strong> &mdash; put
          that on the bulletin, or link it from the website.
        </p>
      </div>

      <GroupsClient groups={data} />
    </>
  );
}

async function loadGroups(): Promise<GroupSummary[] | null> {
  try {
    const [groups, smsCounts, emailCounts] = await Promise.all([
      listGroups(),
      groupReachCounts("sms"),
      groupReachCounts("email"),
    ]);

    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      selfServe: group.selfServe,
      smsCount: smsCounts.get(group.id) ?? 0,
      emailCount: emailCounts.get(group.id) ?? 0,
    }));
  } catch (error) {
    console.error("[admin] groups load failed", error);
    return null;
  }
}
