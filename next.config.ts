import type { NextConfig } from "next";

const isNetlifyBuild = process.env.NETLIFY_BUILD === "true";

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath: isNetlifyBuild ? "tsconfig.netlify.json" : "tsconfig.json",
  },
  experimental: {
    // Member and announcement photos are posted through server actions.
    // Photos are shrunk in the browser first (app/app/PhotoInput.tsx); this
    // is the backstop. Netlify functions cap request bodies near 6 MB.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
