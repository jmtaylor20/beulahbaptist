import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const base = new URL(`${host.includes("localhost") ? "http" : "https"}://${host}`);
  return {
    metadataBase: base,
    title: { default: "Beulah Baptist Church", template: "%s | Beulah Baptist Church" },
    description: "Beulah Baptist Church in Dadeville, Alabama — a Southern Baptist church and member of the Tallapoosa Baptist Association.",
    icons: { icon: "/images/logo-seal.png", shortcut: "/images/logo-seal.png" },
    openGraph: { title: "Beulah Baptist Church", description: "Faith · Family · Fellowship in Dadeville, Alabama", type: "website", images: [{ url: new URL("/og.png", base).toString(), width: 1200, height: 630, alt: "Beulah Baptist Church" }] },
    twitter: { card: "summary_large_image", title: "Beulah Baptist Church", description: "Faith · Family · Fellowship in Dadeville, Alabama", images: [new URL("/og.png", base).toString()] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
