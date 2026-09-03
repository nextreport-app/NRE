"use client";

/**
 * Account settings section for Google Ads API connection.
 * OAuth routes (/api/google-ads/connect, callback) are rolling out — this
 * surfaces approval status and setup instructions until Connect is live.
 */
export function GoogleAdsSettings({
  googleAdsConfigured,
}: {
  /** False when GOOGLE_ADS_* env vars are not set on the server. */
  googleAdsConfigured: boolean;
}) {
  return (
    <div id="google-ads" className="scroll-mt-6 space-y-4 rounded-lg border border-dash-border bg-dash-card p-5">
      <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
        NextReport is approved for Google&apos;s Ads API. Connect your Google Ads account for direct sync — same
        read-only reporting as CSV upload, without exporting from the Google Ads UI.
      </p>

      {!googleAdsConfigured ? (
        <p className="text-[13px] text-amber-300">
          Google Ads API credentials are not configured on this server yet. Add GOOGLE_ADS_CLIENT_ID,
          GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ADS_DEVELOPER_TOKEN in Vercel (see .env.example).
        </p>
      ) : (
        <div className="space-y-2 rounded-md border border-dash-border bg-dash-bg p-3">
          <p className="text-[13px] text-dash-ink-secondary">
            OAuth connection is rolling out next. Until then, upload a Google Ads CSV in the report wizard — it
            works today with the same metrics.
          </p>
          <p className="text-[12px] text-dash-ink-secondary">
            When Connect goes live, you&apos;ll authorise read-only access here — separate from your NextReport login
            and from Google Drive.
          </p>
        </div>
      )}

      <p className="text-[12px] text-dash-ink-secondary">
        Approved for read-only campaign reporting · we never create or edit ads on your behalf.
      </p>
    </div>
  );
}
