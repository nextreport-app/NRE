import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep WASM/native rasterizers as Node externals — Turbopack must not bundle them.
  serverExternalPackages: ["@resvg/resvg-wasm", "@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
