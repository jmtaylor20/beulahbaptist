import type { Metadata } from "next";
import { getChurchConfig } from "../../lib/config";
import { optOutEmail } from "../../lib/members";
import { readEmailUnsubscribeToken } from "../../lib/signing";
import "../admin/admin.css";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * One-click email unsubscribe.
 *
 * The address comes from a signed token, never from a query parameter, so the
 * page cannot be used to unsubscribe someone else. Acting on GET is
 * deliberate: RFC 8058 one-click unsubscribe and most mail clients expect the
 * link alone to work, and making people click a second confirm button is the
 * kind of friction that produces spam complaints instead.
 */
export default async function Unsubscribe({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const church = getChurchConfig();
  const { token } = await searchParams;
  const email = token ? await readEmailUnsubscribeToken(token) : null;

  let state: "ok" | "invalid" | "error" = "invalid";

  if (email) {
    try {
      await optOutEmail({
        email,
        context: {
          source: "web_form",
          evidence: "Clicked the unsubscribe link in a church email.",
        },
      });
      state = "ok";
    } catch (error) {
      console.error("[unsubscribe] failed", error);
      state = "error";
    }
  }

  return (
    <main>
      <section className="section wrap" style={{ paddingTop: 160 }}>
        <div className="signup-card">
          {state === "ok" && (
            <>
              <p className="eyebrow">Unsubscribed</p>
              <h2 style={{ fontSize: "1.8rem" }}>You&rsquo;re removed.</h2>
              <p>
                <strong>{email}</strong> will no longer receive emails from{" "}
                {church.name}.
              </p>
              <p style={{ marginBottom: 0 }}>
                This does not affect text messages. To stop those, reply STOP to
                any text from the church.
              </p>
            </>
          )}

          {state === "invalid" && (
            <>
              <p className="eyebrow">Link not recognised</p>
              <h2 style={{ fontSize: "1.8rem" }}>
                That unsubscribe link isn&rsquo;t valid.
              </h2>
              <p>
                It may have been altered or truncated by your email program.
                Call the church office at{" "}
                <a href={`tel:${church.helpContact.replace(/\D/g, "")}`}>
                  {church.helpContact}
                </a>{" "}
                and we&rsquo;ll take care of it.
              </p>
            </>
          )}

          {state === "error" && (
            <>
              <p className="eyebrow">Something went wrong</p>
              <h2 style={{ fontSize: "1.8rem" }}>
                We couldn&rsquo;t process that just now.
              </h2>
              <p>
                Please try the link again, or call the church office at{" "}
                <a href={`tel:${church.helpContact.replace(/\D/g, "")}`}>
                  {church.helpContact}
                </a>
                .
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
