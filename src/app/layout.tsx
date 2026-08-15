import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteChromeFooter } from "@/components/site-chrome-footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Used for the "NextReport" logo wordmark next to the nav icon (public-nav.tsx,
// nav.tsx) — weight 700 is the only one needed there, but 400 is included too
// since a single-weight font causes browsers to synthetically bold/skew any
// other text that might reference this family.
const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NextReport — Automated Ad Reporting",
  description:
    "The next report you send will be fast, smooth, and done before you know it.",
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-navy text-ink-secondary">
        <Providers>{children}</Providers>
        <SiteChromeFooter />
      </body>
    </html>
  );
}
