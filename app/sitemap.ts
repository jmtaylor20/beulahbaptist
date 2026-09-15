import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

/**
 * Public pages only. The admin area and the API are excluded deliberately --
 * they are noindex'd too, but a sitemap is a positive signal and should not
 * be advertising routes that require a session.
 *
 * Priorities reflect what a visitor is most likely searching for: someone
 * looking up a church usually wants service times and directions first.
 */
const PAGES: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/plan-your-visit", priority: 0.9, changeFrequency: "monthly" },
  { path: "/fellowships-events", priority: 0.8, changeFrequency: "weekly" },
  { path: "/ministries", priority: 0.8, changeFrequency: "monthly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.7, changeFrequency: "yearly" },
  { path: "/text", priority: 0.6, changeFrequency: "yearly" },
  { path: "/what-we-believe", priority: 0.6, changeFrequency: "yearly" },
  { path: "/give", priority: 0.6, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PAGES.map((page) => ({
    url: new URL(page.path, `${SITE_URL}/`).toString(),
    lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
