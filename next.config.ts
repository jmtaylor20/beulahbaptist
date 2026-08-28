import path from "node:path";
import type { NextConfig } from "next";

const isNetlifyBuild = process.env.NETLIFY_BUILD === "true";

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath: isNetlifyBuild ? "tsconfig.netlify.json" : "tsconfig.json",
  },
  webpack(config, { webpack }) {
    /*
     * The messaging app reads its D1 and R2 bindings from `cloudflare:workers`,
     * a scheme only the Workers runtime provides. Webpack cannot resolve it and
     * fails the whole Netlify build, taking the public site down with it.
     *
     * Rewriting the request to a shim keeps the marketing site building on
     * Netlify. This uses NormalModuleReplacementPlugin rather than
     * `resolve.alias` because alias resolution runs after webpack's scheme
     * handling, which is what raises UnhandledSchemeError.
     *
     * The admin area still requires the Cloudflare deploy, where the real
     * module and the real bindings exist.
     */
    if (isNetlifyBuild) {
      config.plugins = config.plugins ?? [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^cloudflare:workers$/,
          path.resolve("./lib/cloudflare-env-shim.ts")
        )
      );
    }
    return config;
  },
};

export default nextConfig;
