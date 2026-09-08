import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteChromeFooter } from "@/components/site-chrome-footer";
import { GoogleAnalytics } from "@/components/google-analytics";
import { DEFAULT_KEYWORDS, SITE_NAME, SITE_URL } from "@/lib/seo";

// Geist Mono is kept only for --font-mono (monospace text, if any); Geist
// Sans was removed entirely — Inter is now the ONE sans-serif font loaded,
// per the brand lock (see globals.css's `html, body` rule and --font-sans).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Brand lock — Inter is the ONE font for the entire app (body/html and
// every element inherit it via globals.css's `html, body` rule and the
// `--font-sans` theme token), not just the nav wordmark. The weight list
// covers every Tailwind font-weight utility actually used across the app
// (font-medium/semibold/bold/extrabold) so none of them fall back to a
// browser-synthesized (faux) bold/skew of a weight Inter wasn't loaded in.
const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Automated Ad & Website Reporting`,
    template: `%s — ${SITE_NAME}`,
  },
  description:
    "Send polished Meta, Google Ads, TikTok, and GA4 client reports in under 2 minutes. API sync or CSV upload — PowerPoint (.pptx), live browser link, and PDF export with AI insights.",
  keywords: [...DEFAULT_KEYWORDS],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: `${SITE_NAME} logo` }],
  },
  twitter: {
    card: "summary",
    images: ["/logo.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon-32.png",
    apple: "/favicon-large.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaMeasurementId = process.env.GA_MEASUREMENT_ID?.trim();

  return (
    <html lang="en" className={`${geistMono.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-navy text-ink-secondary">
        {gaMeasurementId ? <GoogleAnalytics measurementId={gaMeasurementId} /> : null}
        <Providers>{children}</Providers>
        <SiteChromeFooter />
      </body>
    </html>
  );
}
