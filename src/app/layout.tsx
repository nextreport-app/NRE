import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/providers";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { SocialLinks } from "@/components/social-links";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NextReport — Automated Ad Reporting",
  description:
    "The next report you send will be fast, smooth, and done before you know it.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/logo.png",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
        <footer className="site-footer border-t border-navy-border bg-navy px-6 py-6">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <span className="text-sm font-semibold text-white">NextReport</span>
            <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-muted">
              <Link href="/" className="hover:text-ink-secondary">Home</Link>
              <Link href="/pricing" className="hover:text-ink-secondary">Pricing</Link>
              <Link href="/help/download" className="hover:text-ink-secondary">How It Works</Link>
              <Link href="/privacy" className="hover:text-ink-secondary">Privacy</Link>
              <Link href="/terms" className="hover:text-ink-secondary">Terms</Link>
              <Link href="/contact" className="hover:text-ink-secondary">Contact</Link>
            </nav>
          </div>
          <div className="mx-auto mt-4 flex max-w-5xl justify-center sm:justify-start">
            <SocialLinks />
          </div>
          <p className="mt-4 text-center text-xs text-ink-muted sm:text-left">
            © 2026 NextReport. All rights reserved.
          </p>
          <p className="mt-3 text-center text-[11px] text-ink-muted">
            Made for digital agencies. Automate your ad reporting.
          </p>
        </footer>
        {/* Hidden on /light-preview via the same CSS mechanism as the
            footer above — see globals.css. */}
        <WhatsAppButton />
      </body>
    </html>
  );
}
