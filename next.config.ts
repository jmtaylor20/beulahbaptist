import type { NextConfig } from "next";

const isNetlifyBuild = process.env.NETLIFY_BUILD === "true";

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath: isNetlifyBuild ? "tsconfig.netlify.json" : "tsconfig.json",
  },
};

export default nextConfig;
