import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /*
       * The admin area, the API, and the one-click unsubscribe endpoint.
       *
       * /unsubscribe matters most: some crawlers and email security scanners
       * follow links in messages, and that route acts on GET. Keeping it out
       * of the crawl is a second line of defence behind the signed token.
       */
      disallow: ["/admin", "/admin/", "/api/", "/unsubscribe", "/media/"],
    },
    sitemap: new URL("/sitemap.xml", `${SITE_URL}/`).toString(),
    host: SITE_URL,
  };
}
