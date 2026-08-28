import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getDb } from "../../../../db";
import { groupMembers, groups, members } from "../../../../db/schema";
import { formatUsPhone } from "../../../../lib/phone";
import {
  MembersClient,
  type GroupRow,
  type MemberRow,
} from "./members-client";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const data = await loadMembers();

  if (!data) {
    return (
      <>
        <h1>People</h1>
        <div className="notice notice-error">
          <p>
            The database isn&rsquo;t reachable yet. Deploy so the migration in{" "}
            <code>drizzle/</code> is applied, then reload.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>People</h1>
      <p className="admin-lede">
        Everyone the church can reach, and how they gave permission.
      </p>
      <MembersClient members={data.members} groups={data.groups} />
    </>
  );
}

async function loadMembers() {
  try {
    const db = getDb();

    const rows = await db
      .select()
      .from(members)
      .orderBy(asc(members.lastName), asc(members.firstName));

    // One join for every member's groups, rather than a query per row.
    const memberships = await db
      .select({
        memberId: groupMembers.memberId,
        groupName: groups.name,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId));

    const byMember = new Map<number, string[]>();
    for (const row of memberships) {
      const list = byMember.get(row.memberId) ?? [];
      list.push(row.groupName);
      byMember.set(row.memberId, list);
    }

    const groupRows: GroupRow[] = (
      await db.select().from(groups).orderBy(asc(groups.name))
    ).map((group) => ({ id: group.id, name: group.name }));

    const memberRows: MemberRow[] = rows.map((member) => ({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      phoneDisplay: member.phone ? formatUsPhone(member.phone) : "",
      email: member.email,
      smsStatus: member.smsStatus,
      emailStatus: member.emailStatus,
      groupNames: (byMember.get(member.id) ?? []).sort(),
    }));

    return { members: memberRows, groups: groupRows };
  } catch (error) {
    console.error("[admin] members load failed", error);
    return null;
  }
}
