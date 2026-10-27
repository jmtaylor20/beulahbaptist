// The church's live address. Canonical links and the sitemap always point here,
// whatever host a preview or redirect was served from.
export const SITE_URL = "https://beulahbaptistchurch.com";

export const canonical = (path: string) => ({ canonical: `${SITE_URL}${path}` });
