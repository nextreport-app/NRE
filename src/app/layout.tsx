import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/providers";

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
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <Providers>{children}</Providers>
        <footer className="border-t border-slate-900 px-6 py-6 text-center text-xs text-slate-500">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link href="/about" className="hover:text-slate-300">About</Link>
            <Link href="/privacy" className="hover:text-slate-300">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-300">Terms of Service</Link>
            <Link href="/contact" className="hover:text-slate-300">Contact</Link>
          </nav>
          <p className="mt-2">© 2026 NextReport. All rights reserved.</p>
        </footer>
      </body>
    </html>
  );
}
