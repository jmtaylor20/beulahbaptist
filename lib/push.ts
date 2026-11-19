import { createSign } from "node:crypto";
import { connect } from "node:http2";
import { supabaseAdmin } from "./supabase/admin";

// Apple Push Notification service (APNs) for the Beulah Members iOS app.
//
// Needs these Netlify environment variables, all from the church's Apple
// Developer account (Certificates, IDs & Profiles → Keys → + → "Apple Push
// Notifications service"):
//   APNS_KEY_ID       10-character key ID
//   APNS_TEAM_ID      10-character team ID
//   APNS_PRIVATE_KEY  contents of the downloaded AuthKey_XXXX.p8 file
//   APNS_BUNDLE_ID    com.bbcdadeville.members (optional, this is the default)
//   APNS_SANDBOX      "true" only while testing Xcode debug builds
// Until they are set, every function here quietly does nothing.

const bundleId = () => process.env.APNS_BUNDLE_ID || "com.bbcdadeville.members";
const configured = () => !!(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY);

let cachedJwt: { token: string; at: number } | null = null;
function providerToken() {
  // Apple accepts a token for up to an hour; refresh every 50 minutes.
  if (cachedJwt && Date.now() - cachedJwt.at < 50 * 60 * 1000) return cachedJwt.token;
  const b64 = (v: object | Buffer) => Buffer.from(v instanceof Buffer ? v : JSON.stringify(v)).toString("base64url");
  const header = b64({ alg: "ES256", kid: process.env.APNS_KEY_ID });
  const claims = b64({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) });
  const key = process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const signature = createSign("SHA256").update(`${header}.${claims}`).sign({ key, dsaEncoding: "ieee-p1363" });
  cachedJwt = { token: `${header}.${claims}.${b64(signature)}`, at: Date.now() };
  return cachedJwt.token;
}

export type PushMessage = {
  title: string;
  body: string;
  /** Members-app path to open when the notification is tapped, e.g. "/calendar". */
  path: string;
};

/** Saves (or moves) a device token to the signed-in person. */
export async function savePushDevice(personId: string, token: string) {
  if (!/^[0-9a-f]{64,200}$/i.test(token)) return;
  await supabaseAdmin().from("push_devices")
    .upsert({ token, person_id: personId, platform: "ios", updated_at: new Date().toISOString() });
}

/**
 * Sends to every active member's iPhone, except `skipPersonId` (usually the
 * person whose action caused it). Never throws: a failed push must not break
 * saving an event or a prayer request.
 */
export async function notifyMembers(message: PushMessage, skipPersonId?: string) {
  if (!configured()) return;
  try {
    const db = supabaseAdmin();
    const { data } = await db.from("push_devices").select("token, person_id, people!inner(status)").eq("people.status", "active");
    const tokens = (data ?? []).filter((d) => d.person_id !== skipPersonId).map((d) => d.token as string);
    if (!tokens.length) return;
    const dead = await sendToApple(tokens, message);
    if (dead.length) await db.from("push_devices").delete().in("token", dead);
  } catch (e) {
    console.error("Push notification failed", e);
  }
}

/** Returns the tokens Apple says are no longer valid (app deleted, etc.). */
function sendToApple(tokens: string[], message: PushMessage): Promise<string[]> {
  const host = process.env.APNS_SANDBOX === "true" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const payload = JSON.stringify({
    aps: { alert: { title: message.title, body: message.body }, sound: "default" },
    path: message.path,
  });
  const jwt = providerToken();
  return new Promise((resolve) => {
    const dead: string[] = [];
    const client = connect(host);
    let pending = tokens.length;
    const finish = () => { if (--pending === 0) { client.close(); resolve(dead); } };
    const timer = setTimeout(() => { client.destroy(); resolve(dead); }, 8000);
    client.on("error", () => { clearTimeout(timer); resolve(dead); });
    client.on("close", () => clearTimeout(timer));
    for (const token of tokens) {
      const req = client.request({
        ":method": "POST", ":path": `/3/device/${token}`,
        authorization: `bearer ${jwt}`, "apns-topic": bundleId(), "apns-push-type": "alert", "apns-priority": "10",
      });
      let status = 0, body = "";
      req.on("response", (h) => { status = Number(h[":status"]); });
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        if (status === 410 || /BadDeviceToken|Unregistered/.test(body)) dead.push(token);
        else if (status !== 200) console.error(`APNs ${status} ${body}`);
        finish();
      });
      req.on("error", finish);
      req.end(payload);
    }
  });
}

/** "Sun, Dec 7 · 6:00 PM · Fellowship Hall" for an event notification. */
export function eventWhen(e: { starts_at: string | null; all_day?: boolean | null; location?: string | null }) {
  if (!e.starts_at) return e.location ?? "";
  const day = new Date(e.starts_at).toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric" });
  const time = e.all_day ? "" : ` · ${new Date(e.starts_at).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" })}`;
  return `${day}${time}${e.location ? ` · ${e.location}` : ""}`;
}
