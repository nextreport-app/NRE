import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@resvg/resvg-wasm", "@sparticuz/chromium", "puppeteer-core"],
  // PDF export is disabled; keep ~66MB Chromium out of traced function bundles.
  outputFileTracingExcludes: {
    "*": [
      "./node_modules/@sparticuz/chromium/**",
      // Vercel runs glibc — musl sharp libs are dead weight on OG/image routes.
      "./node_modules/@img/sharp-libvips-linuxmusl-x64/**",
    ],
    // Daily cron only re-dispatches jobs — no PPTX render (saves ~20MB per deployment).
    "/app/api/cron/purge-reports": ["templates/**"],
  },
};

export default nextConfig;
