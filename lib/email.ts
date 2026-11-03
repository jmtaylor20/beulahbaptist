import { Resend } from "resend";

// All outbound email: account approvals and the weekly newsletter. Sends
// through Resend from the church's Google Workspace domain. If RESEND_API_KEY
// is missing, sends are skipped and the caller gets a clear error.

const FROM = process.env.EMAIL_FROM ?? "Beulah Baptist Church <newsletter@beulahbaptistchurch.com>";
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? "office@beulahbaptistchurch.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.beulahbaptistchurch.com";

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

export async function sendEmail(to: string | string[], subject: string, html: string, text?: string) {
  if (!process.env.RESEND_API_KEY) throw new Error("Email is not set up yet (RESEND_API_KEY is missing).");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: FROM, to, replyTo: REPLY_TO, subject, html, text });
  if (error) throw new Error(error.message);
}

// Newsletter sends go out in batches of 50 BCC-free individual messages so
// each member only sees their own address.
export async function sendBulk(recipients: string[], subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) throw new Error("Email is not set up yet (RESEND_API_KEY is missing).");
  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  for (let i = 0; i < recipients.length; i += 50) {
    const batch = recipients.slice(i, i + 50).map((to) => ({ from: FROM, to, replyTo: REPLY_TO, subject, html }));
    const { error } = await resend.batch.send(batch);
    if (error) throw new Error(`Stopped after ${sent} emails: ${error.message}`);
    sent += batch.length;
  }
  return sent;
}

export function approvalEmail(firstName: string) {
  return {
    subject: "Your Beulah members account is ready",
    html: `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;padding:24px;color:#16263b"><p>Hi ${firstName},</p><p>The church office has approved your account for the Beulah Baptist members app. You can sign in now:</p><p><a href="${APP_URL}" style="display:inline-block;padding:12px 22px;background:#062a52;color:#fff;border-radius:999px;text-decoration:none;font-weight:bold">Open the members app</a></p><p>Tip: on your phone, open that link in Safari or Chrome and choose <b>Add to Home Screen</b> so it works like an app.</p><p>Everything in the app is shared only within our church family.</p><p>Beulah Baptist Church</p></div>`,
  };
}

// ---------------------------------------------------------------------------
// Newsletter rendering. One layout, twelve seasonal looks chosen by month.
// ---------------------------------------------------------------------------

export type NewsletterData = {
  subject: string; intro?: string | null; template?: string | null;
  announcements: { title: string; body?: string | null; image?: string | null; link?: string | null }[];
  events: { title: string; when: string; where?: string | null; description?: string | null }[];
  serving: { title: string; body?: string | null; filled: number; slots?: number | null }[];
  birthdays: { name: string; day: string }[];
  anniversaries: { name: string; day: string }[];
  prayers: { body: string; name?: string | null }[];
  verse?: { text: string; ref: string } | null;
};

const THEMES: Record<string, { accent: string; accent2: string; bg: string; name: string }> = {
  january: { accent: "#062a52", accent2: "#8fb6d8", bg: "#eef3f8", name: "Winter blue" },
  february: { accent: "#6b1e2e", accent2: "#d9a7b0", bg: "#f8eef0", name: "Rose" },
  march: { accent: "#2f5d3a", accent2: "#a7c9a9", bg: "#eef5ee", name: "Spring green" },
  april: { accent: "#3b4b8c", accent2: "#c3b5e3", bg: "#f2f0f8", name: "Easter lavender" },
  may: { accent: "#9a5b1c", accent2: "#f1c27b", bg: "#fbf4e8", name: "Honey" },
  june: { accent: "#0b6e8a", accent2: "#9bd3e3", bg: "#eaf6f9", name: "Summer sky" },
  july: { accent: "#8a1f1f", accent2: "#062a52", bg: "#f8f1ee", name: "Red, white and blue" },
  august: { accent: "#b35a00", accent2: "#f3c07a", bg: "#fbf2e6", name: "Sunset" },
  september: { accent: "#7a4a1d", accent2: "#d8b07a", bg: "#f7f0e6", name: "Harvest" },
  october: { accent: "#8c3b0b", accent2: "#e7a35a", bg: "#f9efe4", name: "Autumn" },
  november: { accent: "#5b3a1e", accent2: "#c9a070", bg: "#f6efe5", name: "Thanksgiving" },
  december: { accent: "#123d2e", accent2: "#c9a227", bg: "#edf4ef", name: "Christmas" },
  classic: { accent: "#062a52", accent2: "#d6a344", bg: "#f7f2e8", name: "Beulah classic" },
};
export const THEME_NAMES = Object.fromEntries(Object.entries(THEMES).map(([k, t]) => [k, t.name]));

const esc = (s: string | null | undefined) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (s: string | null | undefined) => esc(s).split(/\n{2,}/).map((p) => `<p style="margin:0 0 10px;line-height:1.55">${p.replace(/\n/g, "<br>")}</p>`).join("");

export function renderNewsletter(d: NewsletterData) {
  const theme = THEMES[d.template ?? ""] ?? THEMES[new Date().toLocaleString("en-US", { month: "long", timeZone: "America/Chicago" }).toLowerCase()] ?? THEMES.classic;
  const section = (title: string, inner: string) => inner ? `<tr><td style="padding:22px 28px 6px"><p style="margin:0 0 12px;color:${theme.accent};font:800 12px/1 Helvetica,Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;border-bottom:2px solid ${theme.accent2};padding-bottom:8px">${title}</p>${inner}</td></tr>` : "";
  const card = (inner: string) => `<div style="background:#fff;border-radius:12px;padding:16px 18px;margin:0 0 12px;border-left:4px solid ${theme.accent2}">${inner}</div>`;

  const announcements = d.announcements.map((a) => card(`${a.image ? `<img src="${a.image}" alt="" style="width:100%;border-radius:8px;margin:0 0 12px;display:block">` : ""}<h3 style="margin:0 0 8px;color:${theme.accent};font:700 18px Georgia,serif">${esc(a.title)}</h3>${para(a.body)}${a.link ? `<a href="${a.link}" style="color:${theme.accent};font-weight:bold">Learn more &rarr;</a>` : ""}`)).join("");
  const events = d.events.map((e) => card(`<b style="color:${theme.accent};font-family:Georgia,serif;font-size:16px">${esc(e.title)}</b><br><span style="color:#5d6a7b;font-size:14px">${esc(e.when)}${e.where ? ` &middot; ${esc(e.where)}` : ""}</span>${e.description ? `<div style="margin-top:8px;font-size:14px">${para(e.description)}</div>` : ""}`)).join("");
  const serving = d.serving.map((s) => card(`<b style="color:${theme.accent};font-family:Georgia,serif;font-size:16px">${esc(s.title)}</b><br><span style="color:#5d6a7b;font-size:14px">${s.slots ? `${s.filled} of ${s.slots} spots filled` : `${s.filled} signed up`}</span>${s.body ? `<div style="margin-top:8px;font-size:14px">${para(s.body)}</div>` : ""}<a href="${APP_URL}/serving" style="display:inline-block;margin-top:8px;color:${theme.accent};font-weight:bold">Sign up in the app &rarr;</a>`)).join("");
  const celebrations = [...d.birthdays.map((b) => `<li>&#127874; <b>${esc(b.name)}</b> &middot; ${esc(b.day)}</li>`), ...d.anniversaries.map((a) => `<li>&#128141; <b>${esc(a.name)}</b> &middot; ${esc(a.day)}</li>`)];
  const prayers = d.prayers.map((p) => card(`${para(p.body)}${p.name ? `<span style="color:#5d6a7b;font-size:13px">${esc(p.name)}</span>` : ""}`)).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(d.subject)}</title></head>
<body style="margin:0;background:${theme.bg};font-family:Helvetica,Arial,sans-serif;color:#16263b">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${theme.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:${theme.bg}">
<tr><td style="background:${theme.accent};border-radius:14px 14px 0 0;padding:28px;text-align:center;border-bottom:5px solid ${theme.accent2}">
  <img src="https://beulahbaptistchurch.com/images/logo-seal.png" width="72" alt="" style="display:block;margin:0 auto 10px;background:#fff;border-radius:50%;padding:4px">
  <div style="color:#fff;font:800 13px/1 Helvetica,Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase">Beulah Baptist Church</div>
  <h1 style="margin:10px 0 0;color:#fff;font:700 28px/1.15 Georgia,serif">${esc(d.subject)}</h1>
</td></tr>
${d.intro ? `<tr><td style="padding:24px 28px 0;font-size:16px;line-height:1.6">${para(d.intro)}</td></tr>` : ""}
${d.verse ? `<tr><td style="padding:18px 28px 0"><div style="background:#fff;border-radius:12px;padding:18px 20px;text-align:center;font:italic 17px/1.5 Georgia,serif;color:${theme.accent}">&ldquo;${esc(d.verse.text)}&rdquo;<div style="margin-top:8px;font:800 12px Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#5d6a7b;font-style:normal">${esc(d.verse.ref)}</div></div></td></tr>` : ""}
${section("Announcements", announcements)}
${section("Coming up", events)}
${section("Serving", serving)}
${section("Celebrating this week", celebrations.length ? `<ul style="margin:0;padding-left:4px;list-style:none;font-size:15px;line-height:1.9">${celebrations.join("")}</ul>` : "")}
${section("Please pray", prayers)}
<tr><td style="padding:28px;text-align:center;color:#5d6a7b;font-size:12px;line-height:1.6">
  <a href="${APP_URL}" style="display:inline-block;margin-bottom:14px;padding:12px 22px;background:${theme.accent};color:#fff;border-radius:999px;text-decoration:none;font-weight:bold;font-size:13px">Open the members app</a><br>
  Beulah Baptist Church &middot; 5891 Lovelady Road, Dadeville, AL 36853 &middot; 256-825-6515<br>
  Sunday Worship 9:00 &amp; 11:00 AM &middot; Sunday School 10:00 AM &middot; Sunday &amp; Wednesday Nights 6:00 PM<br>
  <span style="color:#8a96a3">You receive this because you are part of the Beulah church family. Shared within the church only.</span>
</td></tr>
</table></td></tr></table></body></html>`;
}
