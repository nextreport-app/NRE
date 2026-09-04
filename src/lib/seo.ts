import type { Metadata } from "next";

export const SITE_URL = "https://nextreport.in";
export const SITE_NAME = "NextReport";

export const DEFAULT_KEYWORDS = [
  "meta ads reporting tool",
  "google ads reporting tool",
  "automated ad reporting",
  "meta reporting automated",
  "google ads reporting automated",
  "csv to ppt",
  "csv to pdf",
  "meta ads csv to powerpoint",
  "google ads csv report",
  "agency reporting software",
  "digital marketing reports",
  "meta marketing api",
  "google ads api sync",
] as const;

export type SitemapEntry = {
  path: string;
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
};

/** Public marketing routes included in sitemap.xml — no auth-only or noindex pages. */
export const PUBLIC_SITEMAP_ROUTES: SitemapEntry[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.9 },
  { path: "/help/download", changeFrequency: "monthly", priority: 0.85 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
  { path: "/refer", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/data-deletion", changeFrequency: "yearly", priority: 0.3 },
];

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
};

/** Consistent Open Graph, Twitter, and canonical metadata for public pages. */
export function pageMetadata({
  title,
  description,
  path,
  keywords = [...DEFAULT_KEYWORDS],
  noIndex = false,
}: PageMetadataInput): Metadata {
  const url = `${SITE_URL}${path}`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      title: `${title} — ${SITE_NAME}`,
      description,
      locale: "en_US",
      images: [{ url: "/logo.png", width: 512, height: 512, alt: `${SITE_NAME} logo` }],
    },
    twitter: {
      card: "summary",
      title: `${title} — ${SITE_NAME}`,
      description,
      images: ["/logo.png"],
    },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export const HOME_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      email: "hello@nextreport.in",
      description:
        "Automated Meta and Google Ads reporting for digital agencies — client-ready decks, browser share links, and PDF exports in under two minutes.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "8",
        priceCurrency: "USD",
        description: "Starter plan from $8/month with 7-day free trial",
      },
      description:
        "Connect Meta or Google Ads via API or upload a CSV to generate client-ready PowerPoint reports, live browser share links, and PDF downloads with AI-written insights.",
      featureList: [
        "Meta Marketing API sync",
        "Google Ads API sync",
        "CSV to PowerPoint",
        "CSV to PDF",
        "Live browser share link",
        "AI campaign summaries",
      ],
    },
  ],
} as const;
