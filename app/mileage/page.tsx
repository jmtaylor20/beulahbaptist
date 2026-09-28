import type { Metadata, Viewport } from "next";
import { configuredPin, hasAccess } from "./access";
import { MileageLoader } from "./MileageLoader";
import "./mileage.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mileage Log",
  description: "Pastor's mileage log for Beulah Baptist Church.",
  robots: { index: false, follow: false },
  manifest: "/mileage.webmanifest",
  icons: { icon: "/images/logo-seal.png", apple: "/images/mileage-icon-180.png" },
  appleWebApp: { capable: true, title: "Mileage", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#062a52",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function MileagePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await hasAccess()) return <MileageLoader />;
  const { error } = await searchParams;
  const ready = !!configuredPin();

  return (
    <div className="mileage-app">
      <header className="ml-header">
        <img src="/images/logo-seal.png" alt="" />
        <div>
          <p className="ml-kicker">Beulah Baptist Church</p>
          <h1>Mileage Log</h1>
        </div>
      </header>
      <main className="ml-main">
        <form className="ml-card" method="post" action="/api/mileage-login">
          <h2>Enter PIN</h2>
          {ready ? (
            <>
              <label className="ml-field">
                <span>PIN</span>
                <input className="ml-big" name="pin" type="password" inputMode="numeric" autoComplete="current-password" autoFocus required />
              </label>
              {error && <p className="ml-hint is-error">That PIN didn’t match. Try again.</p>}
              <div className="ml-actions"><button type="submit" className="button navy">Unlock</button></div>
            </>
          ) : (
            <p className="ml-empty">This page isn’t set up yet.</p>
          )}
        </form>
      </main>
    </div>
  );
}
