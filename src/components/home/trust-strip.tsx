/** A one-line trust statement strip — muted grey background, centered 14px text. Placed below the features section. */
export function TrustStrip() {
  return (
    <div className="border-y border-navy-border bg-navy-panel px-6 py-4">
      <p className="mx-auto max-w-3xl text-center text-sm text-ink-muted">
        Every number comes directly from your CSV export. We never modify Meta or Google&apos;s data.
      </p>
    </div>
  );
}
