import type { Metadata, Viewport } from "next";
import "./app.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Beulah Members", template: "%s | Beulah Members" },
  description: "Member directory, prayer, calendar and announcements for Beulah Baptist Church.",
  robots: { index: false, follow: false },
  manifest: "/app.webmanifest",
  icons: { icon: "/images/logo-seal.png", apple: "/images/mileage-icon-180.png" },
  appleWebApp: { capable: true, title: "Beulah", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#062a52", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function MembersRoot({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
