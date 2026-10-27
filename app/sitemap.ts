import type { MetadataRoute } from "next";
import { SITE_URL } from "./site-url";

// Evergreen pages only. Dated event pages (like Fall Bingo) come and go, so they stay out.
const pages = ["/", "/plan-your-visit", "/about", "/ministries", "/what-we-believe", "/fellowships-events", "/give", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return pages.map((path) => ({
    url: path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
