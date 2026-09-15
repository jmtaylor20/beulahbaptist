import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * ISO-8601 UTC, matching JavaScript's `Date.toISOString()` exactly.
 *
 * SQLite's own CURRENT_TIMESTAMP renders as "2026-08-28 15:00:00" -- no "T",
 * no milliseconds, no "Z". Timestamps written by the app would then sort
 * against defaults incorrectly (a space sorts before "T"), silently breaking
 * every "rows newer than X" comparison. Every timestamp in this schema is
 * therefore written in one format.
 */
const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/**
 * People in the congregation. A member may have a phone, an email, or both --
 * someone who only wants the newsletter never needs to give us a number.
 *
 * `smsStatus` and `emailStatus` are tracked separately because consent is
 * per-channel: replying STOP to a text must not silently drop someone from the
 * email list, and vice versa.
 */
export const members = sqliteTable(
  "members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    /** E.164, e.g. +12568256515. Null when the member is email-only. */
    phone: text("phone"),
    email: text("email"),
    /** pending -> confirmed once double opt-in completes. */
    smsStatus: text("sms_status", {
      enum: ["none", "pending", "confirmed", "opted_out", "undeliverable"],
    })
      .notNull()
      .default("none"),
    emailStatus: text("email_status", {
      enum: ["none", "confirmed", "opted_out", "bounced"],
    })
      .notNull()
      .default("none"),
    /** Set when a carrier tells us the number cannot receive MMS. */
    mmsCapable: integer("mms_capable", { mode: "boolean" }),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("members_phone_unique").on(table.phone),
    index("members_email_idx").on(table.email),
    index("members_sms_status_idx").on(table.smsStatus),
  ]
);

/** Named audiences: "Whole Church", "Youth Parents", "Deacons", "Choir". */
export const groups = sqliteTable(
  "groups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    /** Whether members may add themselves to this group at signup. */
    selfServe: integer("self_serve", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [uniqueIndex("groups_slug_unique").on(table.slug)]
);

export const groupMembers = sqliteTable(
  "group_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("group_members_unique").on(table.groupId, table.memberId),
    index("group_members_member_idx").on(table.memberId),
  ]
);

/**
 * Append-only record of every consent change. This is the church's legal
 * defence under the TCPA, so nothing in here is ever updated or deleted --
 * corrections are written as new rows.
 */
export const consentEvents = sqliteTable(
  "consent_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    /** Kept denormalised so the trail survives a member row being deleted. */
    phone: text("phone"),
    email: text("email"),
    channel: text("channel", { enum: ["sms", "email"] }).notNull(),
    action: text("action", {
      enum: ["opt_in_requested", "opt_in_confirmed", "opt_out", "opt_in_resumed"],
    }).notNull(),
    /** web_form, sms_keyword, admin, import, bounce */
    source: text("source").notNull(),
    /** Verbatim text the member sent or the exact wording they agreed to. */
    evidence: text("evidence").notNull().default(""),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    index("consent_events_member_idx").on(table.memberId),
    index("consent_events_phone_idx").on(table.phone),
  ]
);

/** Short-lived numeric codes for phone verification (double opt-in). */
export const verificationCodes = sqliteTable(
  "verification_codes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [index("verification_codes_phone_idx").on(table.phone)]
);

/** Staff who may sign in to the admin area. Allowlist -- no open registration. */
export const staff = sqliteTable(
  "staff",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    role: text("role", { enum: ["admin", "sender"] })
      .notNull()
      .default("sender"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    lastSignInAt: text("last_sign_in_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [uniqueIndex("staff_email_unique").on(table.email)]
);

/** Single-use magic-link tokens. Stored hashed so a DB leak grants nothing. */
export const signInTokens = sqliteTable(
  "sign_in_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    staffId: integer("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [uniqueIndex("sign_in_tokens_hash_unique").on(table.tokenHash)]
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    staffId: integer("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [uniqueIndex("sessions_hash_unique").on(table.tokenHash)]
);

/** Images attached to MMS broadcasts. Bytes live in R2; this is the index. */
export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  /** Object key within the R2 bucket. */
  key: text("key").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  originalName: text("original_name").notNull().default(""),
  uploadedBy: integer("uploaded_by").references(() => staff.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at").notNull().default(now),
});

/**
 * One composed message, sent to one or more groups. Cost figures are captured
 * at send time in cents so a later change to the rate table never rewrites
 * history.
 */
export const broadcasts = sqliteTable(
  "broadcasts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    channel: text("channel", { enum: ["sms", "email"] }).notNull(),
    /** Email only. */
    subject: text("subject").notNull().default(""),
    body: text("body").notNull(),
    /** SMS only -- presence of a media asset makes this an MMS. */
    mediaId: text("media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    status: text("status", {
      enum: ["draft", "sending", "sent", "failed", "canceled"],
    })
      .notNull()
      .default("draft"),
    /** JSON array of group ids this went to. */
    groupIds: text("group_ids").notNull().default("[]"),
    recipientCount: integer("recipient_count").notNull().default(0),
    /** Billable segments per recipient at compose time (1 for MMS/email). */
    segmentsPerRecipient: integer("segments_per_recipient").notNull().default(1),
    estimatedCostCents: integer("estimated_cost_cents").notNull().default(0),
    /** Summed from delivery receipts as they arrive. */
    actualCostCents: integer("actual_cost_cents").notNull().default(0),
    createdBy: integer("created_by").references(() => staff.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(now),
    sentAt: text("sent_at"),
  },
  (table) => [index("broadcasts_created_at_idx").on(table.createdAt)]
);

/** One row per recipient per broadcast. Drives delivery reporting. */
export const deliveries = sqliteTable(
  "deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    broadcastId: integer("broadcast_id")
      .notNull()
      .references(() => broadcasts.id, { onDelete: "cascade" }),
    memberId: integer("member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    /** Destination as sent -- phone for sms, address for email. */
    destination: text("destination").notNull(),
    /** Twilio Message SID, or the SES message id. */
    providerId: text("provider_id"),
    status: text("status", {
      enum: [
        "queued",
        "sent",
        "delivered",
        "undelivered",
        "failed",
        "bounced",
      ],
    })
      .notNull()
      .default("queued"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    /** Populated from Twilio's status callback; authoritative over estimates. */
    priceCents: integer("price_cents"),
    segments: integer("segments").notNull().default(1),
    updatedAt: text("updated_at").notNull().default(now),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    index("deliveries_broadcast_idx").on(table.broadcastId),
    uniqueIndex("deliveries_provider_id_unique").on(table.providerId),
    index("deliveries_status_idx").on(table.status),
  ]
);

/** Inbound texts from members -- replies plus the keyword traffic. */
export const inboundMessages = sqliteTable(
  "inbound_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    fromPhone: text("from_phone").notNull(),
    body: text("body").notNull().default(""),
    providerId: text("provider_id"),
    /** Set when the body matched STOP/START/HELP. */
    keyword: text("keyword"),
    handledAt: text("handled_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    index("inbound_messages_created_at_idx").on(table.createdAt),
    index("inbound_messages_member_idx").on(table.memberId),
  ]
);

/** Key/value settings editable from the admin UI (rates, sender name, etc). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(now),
});
