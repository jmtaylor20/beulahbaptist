# Church messaging — setup guide

This replaces Flocknote with texting, picture messaging, and email that the
church runs itself. Budget roughly **$5/month in fixed costs plus what you
actually send** (see [Costs](#costs)), against $50–80/month today.

Work through this in order. Nothing here needs a developer, but step 3 takes a
few business days to be approved, so start it first.

---

## What you get

- **Text and picture messages** to whole groups, with the cost shown before you
  press send
- **Email newsletters** at effectively no cost
- **Members sign themselves up** at `yourchurch.org/text` and manage their own
  numbers, so the office is not keeping a spreadsheet
- **STOP handled automatically**, with a permanent record of who consented,
  when, and how
- **Replies** from members land on the dashboard

---

## 1. Decide who runs it

You need one person who can hold the Twilio and AWS logins. Everything else is
done from the church website.

## 2. Create the accounts

### Twilio (texting)

1. Sign up at [twilio.com](https://www.twilio.com/try-twilio).
2. **Apply to [Twilio.org's Impact Access Program](https://www.twilio.org/en-us/support-and-resources/impact-access-program) first.**
   As a 501(c)(3) the church gets a $100 credit and **25% off** Twilio's
   charges for as long as you use it. Approval can take a few days, and the
   discount does not apply retroactively, so do this before you spend anything.
3. Buy one **local 10-digit number** in your area code (~$1.15/month).

### Amazon SES (email)

1. In the AWS console open **Simple Email Service**.
2. Verify your church's sending domain (or at minimum the from-address).
3. Request **production access** — new accounts start in a sandbox that can
   only email verified addresses. This is a short form and usually approved
   within a day.
4. Create an IAM user with only the `ses:SendEmail` permission and save its
   access key.

## 3. Register for A2P 10DLC (start this early)

US carriers require every business and organisation sending texts to register.
Unregistered traffic gets filtered or blocked outright.

1. In the Twilio console go to **Messaging → Regulatory Compliance → A2P 10DLC**.
2. Register a **Brand**. Choose business type **Non-profit corporation** and
   company type **US Non Profit**. You will need the church's EIN, legal name,
   and address exactly as they appear on the IRS letter — a mismatch is the
   most common cause of rejection.
3. Register a **Campaign** and pick the **Charity / 501(c)(3)** use case, which
   is the cheapest monthly fee available.
4. For the campaign you must supply sample messages and describe how people opt
   in. Point at `https://yourchurch.org/text` and paste the consent wording
   shown on that page.
5. Create a **Messaging Service**, add your number to it, and attach the
   campaign. Turn on **Advanced Opt-Out** so Twilio handles STOP at the carrier
   level as well.

One-time cost: about **$19.50** ($4.50 brand + $15 campaign vetting). Approval
typically takes up to 5 business days.

## 4. Set the environment variables

Set these in your hosting platform's settings. **Never commit them.**

| Variable | Required | What it is |
| --- | --- | --- |
| `APP_SECRET` | **Yes** | Random string, 32+ characters. Generate with `openssl rand -base64 32`. Signs sign-in links and unsubscribe links. |
| `PUBLIC_BASE_URL` | **Yes** | Your real public URL, e.g. `https://beulahbaptistdadeville.org`. Twilio fetches picture messages from here, so a wrong value means pictures silently fail. |
| `ADMIN_BOOTSTRAP_EMAIL` | First run | Your email. Creates the first staff account (see step 5), then can be removed. |
| `TWILIO_ACCOUNT_SID` | For texting | From the Twilio console. |
| `TWILIO_AUTH_TOKEN` | For texting | From the Twilio console. Also verifies incoming webhooks. |
| `TWILIO_MESSAGING_SERVICE_SID` | For texting | The Messaging Service from step 3. Preferred over a bare number. |
| `TWILIO_FROM_NUMBER` | Alternative | Use only if you are not using a Messaging Service. |
| `TWILIO_NONPROFIT_DISCOUNT` | Recommended | Set to `0.25` once Impact Access is approved, so the cost preview matches your real bill. |
| `AWS_ACCESS_KEY_ID` | For email | From the IAM user in step 2. |
| `AWS_SECRET_ACCESS_KEY` | For email | From the IAM user in step 2. |
| `AWS_REGION` | For email | The SES region, e.g. `us-east-1`. |
| `EMAIL_FROM` | For email | Verified sending address, e.g. `office@yourchurch.org`. |
| `CHURCH_NAME` | Optional | Defaults to "Beulah Baptist Church". |
| `CHURCH_SHORT_NAME` | Optional | Used inside texts, where every character is billed. |
| `CHURCH_HELP_CONTACT` | Optional | Phone number given in the HELP auto-reply. |
| `TWILIO_SEND_KEYWORD_REPLIES` | Optional | Set to `true` **only** if you are not using a Messaging Service with Advanced Opt-Out. Otherwise members get two replies to every STOP. |

## 5. Sign in for the first time

1. Set `ADMIN_BOOTSTRAP_EMAIL` to your address and deploy.
2. Go to `/admin/signin`, enter that address, and click the emailed link.
3. That creates your account. The bootstrap only works while the staff table is
   empty, so it cannot be used again — but you can remove the variable once you
   are in.

## 6. Point Twilio at the webhooks

In the Twilio console, on your Messaging Service:

- **Incoming messages** → `https://yourchurch.org/api/twilio/inbound`
- **Delivery status callback** → `https://yourchurch.org/api/twilio/status`

Both verify Twilio's signature and reject anything unsigned, so they are safe
to expose.

## 7. Bring your people over

1. In Flocknote, export your contacts to CSV.
2. Go to **People → Import a CSV** and upload it.
3. **Click "Check the file first."** This reports exactly what would happen —
   how many would be added, how many skipped and why — without changing
   anything. Fix the file and re-check until it looks right.
4. Tick *"These people already agreed to receive texts on our previous
   platform"* **only if that is true.** It marks everyone as subscribed and
   records that you attested to their prior consent. Anyone who has already
   opted out here stays opted out, and an old export cannot resurrect them.
5. Import for real.

Columns named First Name, Last Name, Phone (or Mobile/Cell), Email, and Groups
are matched automatically.

## 8. Test before you announce it

Add yourself as a member, put yourself in a test group, and:

- Send a plain text. Check it arrives and the cost preview matched.
- Send one with a picture. Check the image is right side up and readable.
- Reply **STOP**, and confirm your status flips to "Opted out" on the People
  page. Reply **START** to rejoin.
- Send a test email and click the unsubscribe link.

Only then put `/text` on the bulletin and cancel Flocknote.

---

## Costs

Fixed, per month:

| Item | Cost |
| --- | --- |
| Phone number | $1.15 |
| A2P campaign (Charity use case) | ~$3.00 |
| Email (Amazon SES, ~3,000/month) | ~$0.30 |
| Database and image storage | $0 (free tier) |
| **Total fixed** | **~$4.45** |

Per message, with the 25% nonprofit discount:

| Type | Per recipient |
| --- | --- |
| Text, under 160 characters | $0.0104 |
| Text, 160–306 characters | $0.0209 |
| **Picture message (plus up to 1,600 characters)** | **$0.0255** |
| Email | ~$0.0001 |

So a photo announcement to 350 people costs about **$8.93**. A plain text to
the same list is about **$7.30**.

> **The 160-character cliff.** Texts are billed per 160-character segment — but
> only using a restricted character set. One emoji, or one curly apostrophe
> pasted from Word, drops every segment to **70 characters** and can add 50% to
> the bill. The composer detects this, shows you which character caused it, and
> offers a one-click fix. A picture message has no such problem: it is billed
> per message regardless of length.

## Staying legal

The church is now the sender, so TCPA compliance sits with you rather than
Flocknote. The app does most of it, but the rules that matter:

- **Only text people who asked.** Every subscriber must have opted in through
  the signup form, been added with a written consent note, or come from an
  import you attested to.
- **STOP always wins.** Handled automatically, recorded permanently, and
  honoured even if a later import contains that number again.
- **Keep the record.** The consent log is append-only by design. Do not edit it.
- **Identify the church** in messages. Leaving the "Reply STOP to opt out"
  footer on is the safe default.

Statutory damages run $500–$1,500 **per message**, so when in doubt, do not
send.

## Where things live

| Path | What it does |
| --- | --- |
| `/text` | Public signup with double opt-in — put this on the bulletin |
| `/admin` | Dashboard: reach, spend, recent sends, replies |
| `/admin/compose` | Write and price a message |
| `/admin/members` | People, search, CSV import |
| `/admin/groups` | Groups, and which appear on the signup form |
| `/admin/broadcasts` | Full send history with real delivered costs |
| `/unsubscribe` | One-click email unsubscribe |

## Running the tests

```bash
npm run test:unit   # segment/cost maths, phone parsing, keywords, CSV
npm test            # the above, plus a build and render checks
```

The unit tests cover the logic where a bug is expensive: miscounting segments
overcharges on every send, and a missed STOP keyword is a compliance failure.

## A note on hosting

The messaging app needs **Cloudflare D1** (database) and **R2** (images), which
are declared in `.openai/hosting.json` and only exist on the Cloudflare deploy.

The site also builds for Netlify (`npm run build:netlify`), and that path still
works — the public pages render fine there. But the admin area and the webhooks
will not function on Netlify, because the bindings are absent. **Deploy to
Cloudflare** for the messaging features.
