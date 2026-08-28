import type { Metadata } from "next";
import "../admin.css";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

// Reads ?error / ?sent from the URL, so it cannot be statically rendered.
export const dynamic = "force-dynamic";

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="admin-shell">
      <main className="admin-main">
        <div className="wrap" style={{ maxWidth: 460 }}>
          <h1 style={{ fontSize: "1.8rem" }}>Church messaging</h1>
          <p className="admin-lede">
            Sign in with your church email address. We&rsquo;ll send you a link
            &mdash; there is no password to remember.
          </p>

          {params.error === "expired" && (
            <div className="notice notice-error">
              <p>
                That sign-in link has expired or was already used. Request a new
                one below.
              </p>
            </div>
          )}

          {params.sent === "1" ? (
            <div className="notice notice-ok">
              <p>
                <strong>Check your inbox.</strong> If that address is on the
                church staff list, a sign-in link is on its way. It expires in
                15 minutes.
              </p>
            </div>
          ) : null}

          <div className="card">
            <form className="admin-form" action="/api/auth/request" method="post">
              <label>
                Church email address
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.org"
                />
              </label>
              <button className="btn btn-primary" type="submit">
                Email me a sign-in link
              </button>
            </form>
          </div>

          <p
            style={{
              marginTop: 20,
              fontSize: "0.8rem",
              color: "var(--muted)",
            }}
          >
            Staff access is by invitation. If you need an account, ask the
            church office to add your address.
          </p>
        </div>
      </main>
    </div>
  );
}
