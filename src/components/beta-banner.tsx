"use client";

import { useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "nre-beta-banner-dismissed";

const emptySubscribe = () => () => {};

/**
 * Reads the persisted dismiss state via useSyncExternalStore rather than a
 * useEffect + setState-on-mount — localStorage doesn't exist during SSR, so
 * the server snapshot is "dismissed" (renders nothing) and the client's
 * first render corrects it once it actually knows. Same one-extra-paint
 * tradeoff a useEffect-based read would have anyway, without triggering
 * react-hooks' set-state-in-effect warning.
 */
function useStoredDismissed(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => localStorage.getItem(STORAGE_KEY) === "1",
    () => true,
  );
}

/**
 * Private-beta announcement banner shown above PublicNav on every public
 * page. Dismissal is remembered in localStorage (STORAGE_KEY) so it never
 * reappears for a visitor who already closed it.
 *
 * Not itself something to hide during the beta (it's the beta
 * announcement), so no BETA_HIDE_PRICING-style flag — just stop rendering
 * `<BetaBanner />` at each public page's call site once the beta ends.
 */
export function BetaBanner() {
  const storedDismissed = useStoredDismissed();
  const [clickDismissed, setClickDismissed] = useState(false);

  if (storedDismissed || clickDismissed) return null;

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setClickDismissed(true);
  }

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 px-4 py-1 text-center sm:py-2"
      style={{ backgroundColor: "#f5b45a", color: "#0d1b2e" }}
    >
      <p className="text-xs font-medium sm:text-[13px]">
        🚀 Now in beta — 7-day free trial, no card required ·{" "}
        <a href="mailto:hello@nextreport.in" className="underline hover:no-underline">
          hello@nextreport.in
        </a>
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss beta announcement"
        className="shrink-0 text-sm font-bold leading-none hover:opacity-70 sm:text-[16px]"
      >
        ×
      </button>
    </div>
  );
}
