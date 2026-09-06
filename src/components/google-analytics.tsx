import Script from "next/script";

/**
 * GA4 measurement tag — only rendered when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
 * Loads afterInteractive so it does not block first paint.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-gtag" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
