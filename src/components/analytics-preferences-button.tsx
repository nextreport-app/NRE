"use client";

import { ANALYTICS_PREFERENCES_EVENT } from "@/lib/analytics";

/** A permanent preference entry point on Privacy, without a floating tab. */
export function AnalyticsPreferencesButton() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT))} className="underline underline-offset-4">Analytics preferences</button>;
}
