import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: false,
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host", value: "www.nextreport.in" }], destination: "https://nextreport.in/:path*", permanent: true }];
  },
  async headers() {
    const privateHeaders = ["/api/:path*", "/clients/:path*", "/account", "/billing", "/support", "/admin/:path*", "/dashboard", "/r/:path*", "/verify-email"].map(source => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }));
    return process.env.VERCEL_ENV === "preview" ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }, ...privateHeaders] : privateHeaders;
  },
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
