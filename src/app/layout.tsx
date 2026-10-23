import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SITE_THEME_BOOT_SCRIPT } from "@/components/site-theme-provider";
import { SiteChromeFooter } from "@/components/site-chrome-footer";
import { GoogleAnalytics } from "@/components/google-analytics";
import { rootMetadataWithVerification } from "@/lib/seo";
import { getVisitorCountryCode } from "@/lib/visitor-geo";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = rootMetadataWithVerification();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaMeasurementId = process.env.GA_MEASUREMENT_ID?.trim();
  const initialVisitorCountryCode = await getVisitorCountryCode();

  return (
    <html lang="en" className={`${geistMono.variable} ${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SITE_THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-navy text-ink-secondary">
        {gaMeasurementId ? <GoogleAnalytics measurementId={gaMeasurementId} /> : null}
        <Providers initialVisitorCountryCode={initialVisitorCountryCode}>
          {children}
          <SiteChromeFooter />
        </Providers>
      </body>
    </html>
  );
}
