import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep WASM/native rasterizers as Node externals — Turbopack must not bundle them.
  serverExternalPackages: ["@resvg/resvg-wasm", "@sparticuz/chromium", "puppeteer-core"],
  // @sparticuz/chromium resolves bin/*.br at runtime via relative paths — NFT must include them.
  // Only PDF routes need the ~50MB Chromium binary. Do NOT use `/api/clients/*/reports/*` —
  // that pattern attaches Chromium to analyze/preview/sync-api too and blows Vercel Function Storage.
  outputFileTracingIncludes: {
    "/api/reports/[id]/download-pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/r/[token]/download-pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/clients/[id]/reports/[reportId]": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
