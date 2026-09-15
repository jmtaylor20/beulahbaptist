/**
 * Bindings this project expects from the Cloudflare Workers runtime.
 *
 * `@cloudflare/workers-types` declares `Cloudflare.Env` as an empty interface
 * and expects each project to augment it by declaration merging, which is what
 * this file does. (`wrangler types` would generate the
 * same thing from a wrangler config; this repo declares its bindings in
 * `.openai/hosting.json` instead, so they are written out by hand.)
 *
 * Both are optional: a deploy can be missing one, and `getDb()` and the R2
 * helpers check for that so the failure is a readable message rather than a
 * TypeError deep in a query.
 */

/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    /** D1 database holding members, groups, broadcasts, and the consent log. */
    DB?: D1Database;
    /** R2 bucket holding images attached to picture messages. */
    MEDIA?: R2Bucket;
  }
}
