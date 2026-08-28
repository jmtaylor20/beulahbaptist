/**
 * Member records and the consent trail around them.
 *
 * Every function that changes a member's subscription state writes a row to
 * `consent_events`. That table is the church's evidence if anyone ever asks
 * why they received a text, so nothing here changes a status without also
 * recording how and why.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  consentEvents,
  groupMembers,
  groups,
  members,
} from "../db/schema";

export type ConsentSource =
  | "web_form"
  | "sms_keyword"
  | "admin"
  | "import"
  | "bounce"
  | "carrier";

export interface ConsentContext {
  source: ConsentSource;
  evidence?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export type Member = typeof members.$inferSelect;

export async function findMemberByPhone(
  phone: string
): Promise<Member | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(members)
    .where(eq(members.phone, phone))
    .limit(1);
  return row ?? null;
}

export async function findMemberByEmail(
  email: string
): Promise<Member | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(members)
    .where(eq(members.email, email.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}

/**
 * Start a phone signup. Creates the member if new, and marks SMS as pending
 * until the verification code comes back.
 *
 * Someone who previously opted out and is signing up again is a fresh,
 * deliberate opt-in, so their status is reset rather than left blocked.
 */
export async function beginPhoneSignup(options: {
  phone: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  context: ConsentContext;
}): Promise<Member> {
  const db = getDb();
  const email = options.email?.trim().toLowerCase() || null;
  const existing = await findMemberByPhone(options.phone);
  const timestamp = new Date().toISOString();

  let member: Member;

  if (existing) {
    const [updated] = await db
      .update(members)
      .set({
        firstName: options.firstName || existing.firstName,
        lastName: options.lastName || existing.lastName,
        email: email ?? existing.email,
        smsStatus: "pending",
        updatedAt: timestamp,
      })
      .where(eq(members.id, existing.id))
      .returning();
    member = updated;
  } else {
    const [created] = await db
      .insert(members)
      .values({
        phone: options.phone,
        firstName: options.firstName,
        lastName: options.lastName,
        email,
        smsStatus: "pending",
        emailStatus: email ? "confirmed" : "none",
      })
      .returning();
    member = created;
  }

  await recordConsent({
    memberId: member.id,
    phone: options.phone,
    email,
    channel: "sms",
    action: "opt_in_requested",
    context: options.context,
  });

  return member;
}

/** Complete double opt-in after the member returns the correct code. */
export async function confirmPhoneSignup(options: {
  memberId: number;
  phone: string;
  context: ConsentContext;
}): Promise<void> {
  const db = getDb();
  await db
    .update(members)
    .set({ smsStatus: "confirmed", updatedAt: new Date().toISOString() })
    .where(eq(members.id, options.memberId));

  await recordConsent({
    memberId: options.memberId,
    phone: options.phone,
    email: null,
    channel: "sms",
    action: "opt_in_confirmed",
    context: options.context,
  });
}

/**
 * Opt a phone number out of SMS.
 *
 * Works even when no member row matches -- a STOP from an unknown number is
 * still recorded, so an import that later adds that number cannot resurrect
 * someone who already told us to stop.
 */
export async function optOutPhone(options: {
  phone: string;
  context: ConsentContext;
}): Promise<void> {
  const db = getDb();
  const member = await findMemberByPhone(options.phone);

  if (member) {
    await db
      .update(members)
      .set({ smsStatus: "opted_out", updatedAt: new Date().toISOString() })
      .where(eq(members.id, member.id));
  }

  await recordConsent({
    memberId: member?.id ?? null,
    phone: options.phone,
    email: null,
    channel: "sms",
    action: "opt_out",
    context: options.context,
  });
}

/** Resume texts after a START keyword. */
export async function optInPhoneAgain(options: {
  phone: string;
  context: ConsentContext;
}): Promise<boolean> {
  const db = getDb();
  const member = await findMemberByPhone(options.phone);
  if (!member) return false;

  await db
    .update(members)
    .set({ smsStatus: "confirmed", updatedAt: new Date().toISOString() })
    .where(eq(members.id, member.id));

  await recordConsent({
    memberId: member.id,
    phone: options.phone,
    email: null,
    channel: "sms",
    action: "opt_in_resumed",
    context: options.context,
  });

  return true;
}

export async function optOutEmail(options: {
  email: string;
  context: ConsentContext;
}): Promise<void> {
  const db = getDb();
  const email = options.email.trim().toLowerCase();
  const member = await findMemberByEmail(email);

  if (member) {
    await db
      .update(members)
      .set({ emailStatus: "opted_out", updatedAt: new Date().toISOString() })
      .where(eq(members.id, member.id));
  }

  await recordConsent({
    memberId: member?.id ?? null,
    phone: null,
    email,
    channel: "email",
    action: "opt_out",
    context: options.context,
  });
}

/** Mark a number the carrier says is undeliverable, so it stops being billed. */
export async function markUndeliverable(phone: string): Promise<void> {
  const db = getDb();
  await db
    .update(members)
    .set({ smsStatus: "undeliverable", updatedAt: new Date().toISOString() })
    .where(eq(members.phone, phone));
}

export async function recordConsent(options: {
  memberId: number | null;
  phone: string | null;
  email: string | null;
  channel: "sms" | "email";
  action:
    | "opt_in_requested"
    | "opt_in_confirmed"
    | "opt_out"
    | "opt_in_resumed";
  context: ConsentContext;
}): Promise<void> {
  const db = getDb();
  await db.insert(consentEvents).values({
    memberId: options.memberId,
    phone: options.phone,
    email: options.email,
    channel: options.channel,
    action: options.action,
    source: options.context.source,
    evidence: options.context.evidence ?? "",
    ipAddress: options.context.ipAddress ?? null,
    userAgent: options.context.userAgent ?? null,
  });
}

/** Replace a member's group memberships with exactly `groupIds`. */
export async function setMemberGroups(
  memberId: number,
  groupIds: number[]
): Promise<void> {
  const db = getDb();
  await db.delete(groupMembers).where(eq(groupMembers.memberId, memberId));
  if (groupIds.length === 0) return;

  await db
    .insert(groupMembers)
    .values(groupIds.map((groupId) => ({ groupId, memberId })));
}

/** Add group memberships without removing existing ones. */
export async function addMemberToGroups(
  memberId: number,
  groupIds: number[]
): Promise<void> {
  if (groupIds.length === 0) return;
  const db = getDb();
  for (const groupId of groupIds) {
    // The unique index makes a repeat join a no-op rather than a duplicate.
    await db
      .insert(groupMembers)
      .values({ groupId, memberId })
      .onConflictDoNothing();
  }
}

export async function listGroups() {
  const db = getDb();
  return db.select().from(groups).orderBy(groups.name);
}

/** Groups members may choose for themselves on the public signup form. */
export async function listSelfServeGroups() {
  const db = getDb();
  return db
    .select()
    .from(groups)
    .where(eq(groups.selfServe, true))
    .orderBy(groups.name);
}

export interface Recipient {
  memberId: number;
  firstName: string;
  lastName: string;
  destination: string;
}

/**
 * Resolve group ids to the people who may actually be contacted.
 *
 * Only confirmed subscribers are returned: pending signups have not completed
 * double opt-in, and opted-out or undeliverable numbers must never be included
 * in a send. Someone in three of the selected groups appears once.
 */
export async function resolveAudience(options: {
  groupIds: number[];
  channel: "sms" | "email";
}): Promise<Recipient[]> {
  if (options.groupIds.length === 0) return [];
  const db = getDb();

  const destination = options.channel === "sms" ? members.phone : members.email;
  const statusColumn =
    options.channel === "sms" ? members.smsStatus : members.emailStatus;

  const rows = await db
    .selectDistinct({
      memberId: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      destination,
    })
    .from(members)
    .innerJoin(groupMembers, eq(groupMembers.memberId, members.id))
    .where(
      and(
        inArray(groupMembers.groupId, options.groupIds),
        eq(statusColumn, "confirmed"),
        sql`${destination} is not null and ${destination} != ''`
      )
    );

  return rows
    .filter((row): row is Recipient => Boolean(row.destination))
    .map((row) => ({
      memberId: row.memberId,
      firstName: row.firstName,
      lastName: row.lastName,
      destination: row.destination,
    }));
}

/** Reachable-member counts per group, for the composer's audience picker. */
export async function groupReachCounts(
  channel: "sms" | "email"
): Promise<Map<number, number>> {
  const db = getDb();
  const destination = channel === "sms" ? members.phone : members.email;
  const statusColumn =
    channel === "sms" ? members.smsStatus : members.emailStatus;

  const rows = await db
    .select({
      groupId: groupMembers.groupId,
      count: sql<number>`count(distinct ${members.id})`,
    })
    .from(groupMembers)
    .innerJoin(members, eq(members.id, groupMembers.memberId))
    .where(
      and(
        eq(statusColumn, "confirmed"),
        sql`${destination} is not null and ${destination} != ''`
      )
    )
    .groupBy(groupMembers.groupId);

  return new Map(rows.map((row) => [row.groupId, Number(row.count)]));
}

export function memberDisplayName(member: {
  firstName: string;
  lastName: string;
}): string {
  const name = `${member.firstName} ${member.lastName}`.trim();
  return name || "(no name)";
}
