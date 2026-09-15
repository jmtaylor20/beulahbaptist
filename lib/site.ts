/**
 * The site's canonical public origin, resolved once at module load.
 *
 * This exists so the root layout can build absolute metadata URLs *without*
 * calling `headers()`. Reading a request header inside the root layout's
 * `generateMetadata()` opts every route in the app out of static generation,
 * because Next cannot know the host until a request arrives. That one call was
 * turning all nine marketing pages into server-rendered-on-demand routes.
 *
 * Resolution order, most specific first:
 *   1. PUBLIC_BASE_URL  -- set this in production; it is also what Twilio
 *      fetches picture messages from, so the two stay in sync.
 *   2. URL              -- injected by Netlify at build time.
 *   3. CF_PAGES_URL     -- injected by Cloudflare Pages at build time.
 *   4. localhost        -- development.
 *
 * Only affects metadata and absolute link building. Getting it wrong costs you
 * correct canonical/Open Graph URLs, not a working page.
 */

function resolveSiteUrl(): string {
  const candidate =
    process.env.PUBLIC_BASE_URL ||
    process.env.URL ||
    process.env.CF_PAGES_URL ||
    "http://localhost:5173";

  const withScheme = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  return withScheme.replace(/\/+$/, "");
}

export const SITE_URL = resolveSiteUrl();

/** Absolute URL for a site-relative path, e.g. absoluteUrl("/og.png"). */
export function absoluteUrl(path: string): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

/** Church details reused across metadata, structured data, and the footer. */
export const CHURCH = {
  name: "Beulah Baptist Church",
  description:
    "Beulah Baptist Church in Dadeville, Alabama — a Southern Baptist church and member of the Tallapoosa Baptist Association.",
  tagline: "Faith · Family · Fellowship in Dadeville, Alabama",
  street: "5891 Lovelady Road",
  city: "Dadeville",
  state: "AL",
  zip: "36853",
  phone: "+1-256-825-6515",
  phoneDisplay: "256-825-6515",
  // Used for the map link and the structured-data geo hint.
  mapQuery: "5891+Lovelady+Road+Dadeville+AL+36853",
} as const;
