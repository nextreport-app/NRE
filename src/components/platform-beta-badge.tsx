import { platformBetaCardNote, type PlatformBetaId } from "@/lib/platform-beta";

export function PlatformBetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400 ${className ?? ""}`}
    >
      Beta
    </span>
  );
}

export function PlatformBetaNotice({ platform }: { platform?: PlatformBetaId }) {
  const note = platform ? platformBetaCardNote(platform) : null;
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <p className="text-[13px] leading-relaxed text-amber-100/90">
        <span className="font-semibold text-amber-300">Beta platform.</span>{" "}
        {note ??
          "Google Ads, TikTok Ads, and GA4 are in beta — Meta Ads is fully tested. Verify every report before sending to clients."}
      </p>
    </div>
  );
}
