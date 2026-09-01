import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep WASM/native rasterizers as Node externals — Turbopack must not bundle them.
  serverExternalPackages: ["@resvg/resvg-wasm", "@sparticuz/chromium", "puppeteer-core"],
  // @sparticuz/chromium resolves bin/*.br at runtime via relative paths — NFT must include them.
  outputFileTracingIncludes: {
    "/api/reports/*/download-pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/r/*/download-pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/clients/*/reports/*": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
