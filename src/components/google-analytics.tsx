"use client";
import Script from "next/script";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_CONSENT_KEY,
  ANALYTICS_PUBLIC_PATHS,
  analyticsPageLocation,
  validGaMeasurementId,
} from "@/lib/analytics";

type Consent = "granted" | "denied" | null;
function subscribeConsent(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("nre:analytics-consent", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("nre:analytics-consent", onChange);
  };
}
function readConsent(): Consent {
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}
const serverConsent = () => null;
const subscribeHydration = () => () => {};
const hydrated = () => true;
const serverHydrated = () => false;
/** One optional GA tag. SPA pageviews use the stream's enhanced measurement; never double-send manually. */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const savedConsent = useSyncExternalStore(
    subscribeConsent,
    readConsent,
    serverConsent,
  );
  const [sessionConsent, setSessionConsent] = useState<Consent>(null);
  const consent = sessionConsent ?? savedConsent;
  const loaded = useSyncExternalStore(
    subscribeHydration,
    hydrated,
    serverHydrated,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const publicPage = ANALYTICS_PUBLIC_PATHS.has(pathname);
  useEffect(() => {
    (window as unknown as Record<string, unknown>)[
      `ga-disable-${measurementId}`
    ] = consent !== "granted" || !publicPage;
  }, [consent, publicPage, measurementId]);
  if (!validGaMeasurementId(measurementId)) return null;
  function choose(next: "granted" | "denied") {
    try {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, next);
      window.dispatchEvent(new Event("nre:analytics-consent"));
    } catch {
      setSessionConsent(next);
    }
    setSettingsOpen(false);
    const win = window as unknown as { gtag?: (...args: unknown[]) => void };
    (window as unknown as Record<string, unknown>)[
      `ga-disable-${measurementId}`
    ] = next !== "granted";
    win.gtag?.("consent", "update", {
      analytics_storage: next,
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  }
  const location =
    typeof window !== "undefined"
      ? analyticsPageLocation(
          window.location.origin,
          pathname,
          window.location.search,
        )
      : null;
  return (
    <>
      {consent === "granted" && publicPage && location ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
            strategy="lazyOnload"
          />
          <Script id="google-analytics-gtag" strategy="lazyOnload">{`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
gtag('js', new Date());
gtag('config', '${measurementId}', {page_location:${JSON.stringify(location)},page_referrer:${JSON.stringify(typeof document !== "undefined" && document.referrer ? new URL(document.referrer).origin : "")},allow_google_signals:false,allow_ad_personalization_signals:false});
      `}</Script>
        </>
      ) : null}
      {loaded && publicPage ? (
        consent === null || settingsOpen ? (
          <section
            aria-label="Analytics preferences"
            className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl border border-navy-border bg-navy-panel p-4 text-sm text-ink shadow-xl"
          >
            <p>
              Allow optional analytics cookies to help us improve NextReport?
              You can change this choice anytime.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => choose("granted")}
                className="min-h-11 rounded-md border border-navy-border px-4 font-medium"
              >
                Allow analytics
              </button>
              <button
                type="button"
                onClick={() => choose("denied")}
                className="min-h-11 rounded-md border border-navy-border px-4 font-medium"
              >
                Decline
              </button>
              <a
                href="/privacy"
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                Privacy policy
              </a>
            </div>
          </section>
        ) : (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="fixed bottom-3 left-3 z-40 rounded-full border border-navy-border bg-navy-panel px-3 py-2 text-xs text-ink"
          >
            Analytics preferences
          </button>
        )
      ) : null}
    </>
  );
}
