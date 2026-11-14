"use client";

/** Exports the exact in-memory API import, without another provider request. */
export function ApiSourceDownload({ file }: { file: File }) {
  function download() {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name || "meta-api-source.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <details className="mt-6 text-xs text-dash-ink-secondary">
    <summary className="cursor-pointer">Source data</summary>
    <p className="mt-2">Download the data used for this import to compare with Ads Manager.</p>
    <button type="button" onClick={download} className="mt-2 text-sm font-medium text-dash-accent underline">Download synced CSV</button>
  </details>;
}
