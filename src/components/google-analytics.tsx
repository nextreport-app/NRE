"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_CONSENT_KEY,
  ANALYTICS_PUBLIC_PATHS,
  analyticsPageLocation,
  GTM_CONTAINER_ID,
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
/** One consent-gated GTM container. GA4 configuration belongs exclusively in GTM. */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const lastPage = useRef<string | null>(null);
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
    const win = window as unknown as {
      dataLayer: Record<string, unknown>[];
      gtag: (...args: unknown[]) => void;
    };
    const allowed = consent === "granted" && publicPage;
    win.gtag("consent", "update", {
      analytics_storage: allowed ? "granted" : "denied",
      ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    });
    if (!allowed) { lastPage.current = null; return; }
    const location = analyticsPageLocation(window.location.origin, pathname, window.location.search);
    if (lastPage.current !== location) {
      lastPage.current = location;
      win.dataLayer.push({ event: "nre_public_page_view", page_location: location,
        page_path: pathname, page_title: document.title,
        page_referrer: document.referrer ? new URL(document.referrer).origin : "" });
    }
    if (document.getElementById("nre-google-tag-manager")) return;
    win.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const script = document.createElement("script");
    script.id = "nre-google-tag-manager";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_CONTAINER_ID}`;
    document.head.appendChild(script);
  }, [consent, publicPage, pathname]);
  function choose(next: "granted" | "denied") {
    try {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, next);
      window.dispatchEvent(new Event("nre:analytics-consent"));
    } catch { setSessionConsent(next); }
    setSettingsOpen(false);
  }
  return (
    <>
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
