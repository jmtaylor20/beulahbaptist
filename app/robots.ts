import type { MetadataRoute } from "next";
import { SITE_URL } from "./site-url";

// The mileage log and API routes are private tools, not pages for search.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/mileage", "/api"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
