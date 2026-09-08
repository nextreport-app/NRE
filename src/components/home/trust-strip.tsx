/** A one-line trust statement strip — muted grey background, centered 14px text. Placed below the features section. */
export function TrustStrip() {
  return (
    <div className="border-y border-navy-border bg-navy-panel px-4 py-4">
      <p className="mx-auto max-w-6xl overflow-x-auto text-center text-xs whitespace-nowrap text-ink-muted sm:text-sm">
        Every number comes from your connected account or CSV export. We never modify Meta, Google, TikTok, or GA4 data.
      </p>
    </div>
  );
}
