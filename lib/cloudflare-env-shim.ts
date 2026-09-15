/**
 * Stand-in for `cloudflare:workers` on non-Cloudflare builds.
 *
 * The public marketing site is also built for Netlify (`npm run
 * build:netlify`), where webpack cannot resolve the `cloudflare:` scheme and
 * the build fails outright. next.config.ts aliases the module to this file on
 * that build only.
 *
 * `env` is empty here, so `getDb()` and the R2 helpers throw their normal
 * "binding is unavailable" error. Every public page already catches that and
 * degrades gracefully, so the marketing site keeps working; the messaging
 * admin does not, which is correct -- it needs D1 and R2, and therefore the
 * Cloudflare deploy.
 */
export const env: Record<string, unknown> = {};
export default { env };
