import Script from "next/script";

/**
 * GA4 measurement tag — only rendered when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
 * Loads lazyOnload so gtag does not compete with LCP / main-thread on mobile.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="lazyOnload"
      />
      <Script id="google-analytics-gtag" strategy="lazyOnload">
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
