import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep WASM/native rasterizers as Node externals — Turbopack must not bundle them.
  serverExternalPackages: ["@resvg/resvg-wasm"],
  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
};

export default nextConfig;
