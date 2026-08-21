import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteChromeFooter } from "@/components/site-chrome-footer";

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
  title: "NextReport — Automated Ad Reporting",
  description: "Client-ready Meta and Google Ads reports in under 2 minutes.",
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
  return (
    <html lang="en" className={`${geistMono.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-navy text-ink-secondary">
        <Providers>{children}</Providers>
        <SiteChromeFooter />
      </body>
    </html>
  );
}
