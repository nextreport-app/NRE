import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@resvg/resvg-wasm"],
  outputFileTracingExcludes: {
    "*": [
      // Vercel runs glibc — musl sharp libs are dead weight on OG/image routes.
      "./node_modules/@img/sharp-libvips-linuxmusl-x64/**",
    ],
    // Daily cron only re-dispatches jobs — no PPTX render (saves ~20MB per deployment).
    "/app/api/cron/purge-reports": ["templates/**"],
  },
};

export default nextConfig;
