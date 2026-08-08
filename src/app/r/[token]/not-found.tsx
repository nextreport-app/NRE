/**
 * Rendered (with a real 404 status) whenever the token in /r/[token] has no
 * matching report, the report isn't COMPLETE yet, or it was deleted — see
 * page.tsx's getReportByToken, which returns null in all three cases and
 * calls next/navigation's notFound() to reach this segment-scoped boundary.
 */
export default function ReportNotFound() {
  return (
    <div id="share-report-page" className="flex min-h-screen flex-col items-center justify-center bg-navy px-4 text-center">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="NextReport logo" width={32} height={32} className="block" />
        <span className="text-[18px] font-bold text-white">NextReport</span>
      </div>
      <h1 className="mt-8 text-[22px] font-bold text-white">This report is no longer available</h1>
      <p className="mt-2 max-w-md text-[14px] text-dash-ink-secondary">
        The link you followed may be expired, or the report it points to has been removed.
      </p>
    </div>
  );
}
