import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/providers";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { SocialLinks } from "@/components/social-links";
import { BETA_HIDE_PRICING } from "@/lib/beta";

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
        {/* Hidden via pure CSS (globals.css) when the page content contains
            #light-preview-page — that page renders its own light-themed
            footer instead of this dark site-wide one. Deliberately NOT done
            with next/headers's headers() here: that's a dynamic API, and
            calling it in the root layout would force every single page in
            the app to opt out of static rendering, just to hide a footer on
            one internal preview route. */}
        <footer className="site-footer border-t border-navy-border bg-navy px-6 py-10">
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div>
                <Link href="/" className="flex items-center gap-1.5">
                  <img src="/logo.png" alt="NextReport logo" style={{ height: "28px", width: "28px", display: "block" }} />
                  <span
                    className="text-base font-bold text-white"
                    style={{ fontFamily: "var(--font-inter), sans-serif" }}
                  >
                    NextReport
                  </span>
                </Link>
                <p className="mt-3 text-sm text-ink-muted">Automated ad reporting for digital agencies</p>
                <div className="mt-4">
                  <SocialLinks />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white">Product</h3>
                <nav className="mt-3 flex flex-col gap-2 text-sm text-ink-muted">
                  <Link href="/" className="hover:text-white">Home</Link>
                  {/* BETA: hidden during beta period — restore before public launch (see lib/beta.ts's BETA_HIDE_PRICING) */}
                  {!BETA_HIDE_PRICING && (
                    <Link href="/pricing" className="hover:text-white">Pricing</Link>
                  )}
                  <Link href="/help/download" className="hover:text-white">How It Works</Link>
                  <Link href="/help/download" className="hover:text-white">Download Guide</Link>
                </nav>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white">Company</h3>
                <nav className="mt-3 flex flex-col gap-2 text-sm text-ink-muted">
                  <Link href="/about" className="hover:text-white">About Us</Link>
                  <Link href="/contact" className="hover:text-white">Contact</Link>
                  <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
                  <Link href="/terms" className="hover:text-white">Terms of Service</Link>
                </nav>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-navy-border pt-5 text-xs text-ink-muted sm:flex-row">
              <p>© 2026 NextReport. All rights reserved.</p>
              <p>Made for digital agencies. Automate your ad reporting.</p>
            </div>
          </div>
        </footer>
        {/* Hidden on /light-preview via the same CSS mechanism as the
            footer above — see globals.css. */}
        <WhatsAppButton />
      </body>
    </html>
  );
}
