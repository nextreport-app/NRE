import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV === "preview") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/clients",
        "/account",
        "/billing",
        "/support",
        "/admin",
        "/dashboard",
        "/api/",
        "/login",
        "/signup",
        "/r/",
        "/light-preview",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
