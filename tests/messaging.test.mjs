/**
 * Tests for the pure logic behind what a broadcast costs and who may receive
 * it. These are the parts where a bug is expensive or a compliance failure:
 * miscounting segments overcharges the church on every send, and missing a
 * STOP keyword means texting someone who told us not to.
 *
 * Run with: npm run test:unit
 */

import assert from "node:assert/strict";
import test from "node:test";

import { analyzeMessage, normalizeTypography, typographyWouldSaveSegments } from "../lib/segments.ts";
import { detectKeyword } from "../lib/keywords.ts";
import { parseUsPhone, formatUsPhone } from "../lib/phone.ts";
import { estimateCost, DEFAULT_RATES } from "../lib/pricing.ts";
import { parseCsv, extractContacts } from "../lib/csv.ts";

test("GSM-7 messages bill at 160 characters for a single segment", () => {
  assert.equal(analyzeMessage("A".repeat(160)).segments, 1);
  assert.equal(analyzeMessage("A".repeat(160)).encoding, "GSM-7");
});

test("one character past the limit costs a second segment", () => {
  const result = analyzeMessage("A".repeat(161));
  assert.equal(result.segments, 2);
  // Concatenated segments lose 7 septets to the header, so 161 chars needs 2.
  assert.equal(result.billedUnits, 161);
});

test("multi-segment GSM messages bill at 153 characters each", () => {
  assert.equal(analyzeMessage("A".repeat(306)).segments, 2);
  assert.equal(analyzeMessage("A".repeat(307)).segments, 3);
});

test("GSM extension characters cost two septets", () => {
  // A lone '{' is in the extension table, so 160 of them is 320 septets.
  const result = analyzeMessage("{".repeat(80));
  assert.equal(result.encoding, "GSM-7");
  assert.equal(result.billedUnits, 160);
  assert.equal(result.segments, 1);
});

test("a single emoji forces UCS-2 and collapses the segment size", () => {
  const body = `${"A".repeat(100)}🙂`;
  const result = analyzeMessage(body);
  assert.equal(result.encoding, "UCS-2");
  // 100 chars + a surrogate pair = 102 UTF-16 units, over the 70 limit.
  assert.equal(result.billedUnits, 102);
  assert.equal(result.segments, 2);
  assert.deepEqual(result.offendingCharacters, ["🙂"]);
});

test("a curly apostrophe alone triggers UCS-2", () => {
  // This is the Word/Google Docs paste that silently doubles a church's bill.
  const result = analyzeMessage("Don’t forget Wednesday supper!");
  assert.equal(result.encoding, "UCS-2");
  assert.deepEqual(result.offendingCharacters, ["’"]);
});

test("normalising typography brings a message back to GSM-7", () => {
  const body = "Don’t forget — supper’s at 5:30…";
  assert.equal(analyzeMessage(body).encoding, "UCS-2");
  assert.equal(analyzeMessage(normalizeTypography(body)).encoding, "GSM-7");
});

test("typography fix reports the segments it would actually save", () => {
  // 200 GSM chars would be 2 segments; as UCS-2 it is 3.
  const body = `${"A".repeat(199)}’`;
  assert.equal(analyzeMessage(body).segments, 3);
  assert.equal(typographyWouldSaveSegments(body), 1);
  assert.equal(analyzeMessage(normalizeTypography(body)).segments, 2);
});

test("an empty message still counts as one segment", () => {
  assert.equal(analyzeMessage("").segments, 1);
});

test("STOP keywords are matched regardless of case and punctuation", () => {
  for (const body of ["STOP", "stop", " Stop. ", "UNSUBSCRIBE", "quit", "Stop All"]) {
    assert.equal(detectKeyword(body), "stop", `expected STOP for ${JSON.stringify(body)}`);
  }
});

test("keyword matching does not fire on ordinary sentences", () => {
  // The reason we match whole messages rather than scanning for the word.
  assert.equal(detectKeyword("Please stop by the potluck on Sunday"), null);
  assert.equal(detectKeyword("Can you help me find the nursery?"), null);
  assert.equal(detectKeyword("Yes we will be there"), null);
});

test("START and HELP are recognised", () => {
  assert.equal(detectKeyword("start"), "start");
  assert.equal(detectKeyword("UNSTOP"), "start");
  assert.equal(detectKeyword("help"), "help");
  assert.equal(detectKeyword("INFO"), "help");
});

test("phone numbers normalise to E.164 from the ways people type them", () => {
  for (const input of [
    "(256) 825-6515",
    "256-825-6515",
    "256.825.6515",
    "2568256515",
    "1-256-825-6515",
    "+1 256 825 6515",
  ]) {
    const result = parseUsPhone(input);
    assert.equal(result.ok, true, `expected ${input} to parse`);
    assert.equal(result.e164, "+12568256515");
  }
});

test("invalid phone numbers are rejected rather than guessed at", () => {
  for (const input of ["", "12345", "555", "(025) 825-6515", "256-125-6515"]) {
    assert.equal(parseUsPhone(input).ok, false, `expected ${input} to fail`);
  }
});

test("non-US numbers are rejected so they cannot be billed at foreign rates", () => {
  const result = parseUsPhone("+44 20 7123 4567");
  assert.equal(result.ok, false);
  assert.match(result.reason, /US numbers/);
});

test("phone numbers render back in a readable form", () => {
  assert.equal(formatUsPhone("+12568256515"), "(256) 825-6515");
});

test("MMS is priced per message, not per segment", () => {
  const rates = DEFAULT_RATES;
  const mms = estimateCost({ kind: "mms", recipients: 350, rates });
  // 350 * (0.022 + 0.009)
  assert.equal(mms.total.toFixed(2), "10.85");
  assert.equal(mms.segmentsPerRecipient, 1);
});

test("SMS cost scales with segment count", () => {
  const rates = DEFAULT_RATES;
  const one = estimateCost({ kind: "sms", recipients: 100, segmentsPerRecipient: 1, rates });
  const two = estimateCost({ kind: "sms", recipients: 100, segmentsPerRecipient: 2, rates });
  assert.equal((two.total / one.total).toFixed(4), "2.0000");
});

test("the nonprofit discount applies to Twilio's charge but not carrier fees", () => {
  const rates = { ...DEFAULT_RATES, twilioDiscount: 0.25 };
  const result = estimateCost({ kind: "sms", recipients: 1, segmentsPerRecipient: 1, rates });
  // 0.0083 * 0.75 + 0.0042 -- the carrier fee is pass-through.
  assert.equal(result.perRecipient.toFixed(6), (0.0083 * 0.75 + 0.0042).toFixed(6));
});

test("a nonsensical discount is ignored rather than applied", () => {
  // Guards against someone entering "25" meaning 25 percent.
  const rates = { ...DEFAULT_RATES, twilioDiscount: 25 };
  const result = estimateCost({ kind: "sms", recipients: 1, segmentsPerRecipient: 1, rates });
  assert.ok(result.perRecipient > 0, "cost must never go negative");
});

test("CSV parsing handles quoted fields containing commas", () => {
  const rows = parseCsv('First Name,Last Name,Phone\n"Smith, Jr.",John,2568256515\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], ["Smith, Jr.", "John", "2568256515"]);
});

test("CSV parsing handles escaped quotes and a BOM", () => {
  const rows = parseCsv('﻿Name,Note\nJohn,"He said ""hello"""\n');
  assert.deepEqual(rows[0], ["Name", "Note"]);
  assert.deepEqual(rows[1], ["John", 'He said "hello"']);
});

test("contact extraction maps the column names church tools actually use", () => {
  const rows = parseCsv("First Name,Last Name,Mobile,Email,Groups\nJane,Doe,2568256515,j@example.org,Choir;Deacons\n");
  const { contacts, columns } = extractContacts(rows);
  assert.equal(columns.phone, 2);
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].firstName, "Jane");
  assert.deepEqual(contacts[0].groups, ["Choir", "Deacons"]);
  // Row 2 in the spreadsheet the office is looking at.
  assert.equal(contacts[0].rowNumber, 2);
});

test("a single Name column is split into first and last", () => {
  const rows = parseCsv("Name,Phone\nJane Ann Doe,2568256515\n");
  const { contacts } = extractContacts(rows);
  assert.equal(contacts[0].firstName, "Jane");
  assert.equal(contacts[0].lastName, "Ann Doe");
});
