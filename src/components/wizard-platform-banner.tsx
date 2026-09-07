import Link from "next/link";
import type { Platform } from "@/lib/nre/google-columns";
import { getPlatformLabel, usesSimpleAdWizard } from "@/lib/nre/platform-labels";

/** Context banner shown at the top of wizard Step 1 — explains how each platform's flow differs. */
export function WizardPlatformBanner({ platform }: { platform: Platform }) {
  if (usesSimpleAdWizard(platform)) {
    return (
      <div className="rounded-lg border border-[#63b3ed]/30 bg-[#0d1b2e]/80 px-4 py-3.5">
        <p className="text-[14px] font-semibold text-white">Google Ads — simplified workflow</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dash-ink-secondary">
          After you upload or sync, NextReport skips campaign and objective steps and builds a month-to-date report from
          every campaign in your file. Need to exclude campaigns? Filter them in Google Ads before exporting, or use Meta
          / TikTok for per-campaign control.
        </p>
        <p className="mt-2 text-[12px] text-dash-ink-secondary">
          <Link href="/help/download#google-ads" className="text-dash-accent underline hover:text-dash-accent-hover">
            Google Ads CSV export guide →
          </Link>
        </p>
      </div>
    );
  }

  if (platform === "TIKTOK") {
    return (
      <div className="rounded-lg border border-[#fe2c55]/30 bg-[#0d1b2e]/80 px-4 py-3.5">
        <p className="text-[14px] font-semibold text-white">TikTok Ads — same wizard as Meta</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dash-ink-secondary">
          Campaign selection, objectives, and metric cards work the same way as Meta Ads. TikTok &quot;Ad groups&quot; map
          to ad-set slides in your deck. Reporting uses <span className="text-white">USD</span> from your TikTok
          advertiser account.
        </p>
        <p className="mt-2 text-[12px] text-dash-ink-secondary">
          <Link href="/help/download#tiktok-ads" className="text-dash-accent underline hover:text-dash-accent-hover">
            TikTok Ads CSV export guide →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#1877f2]/30 bg-[#0d1b2e]/80 px-4 py-3.5">
      <p className="text-[14px] font-semibold text-white">Meta Ads — full control</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-dash-ink-secondary">
        Pick campaigns and ad sets, confirm objectives, review metric cards, then choose weekly/monthly/comparison report
        types. Optional Previous Month Data adds a period row on the overview slide.
      </p>
      <p className="mt-2 text-[12px] text-dash-ink-secondary">
        <Link href="/help/download#meta-ads" className="text-dash-accent underline hover:text-dash-accent-hover">
          Meta Ads CSV export guide →
        </Link>
      </p>
    </div>
  );
}

/** Shown on Step 5 for Google — reminds users why the middle steps were skipped. */
export function WizardGoogleGenerateBanner() {
  return (
    <div className="rounded-lg border border-dash-border bg-dash-card p-4">
      <p className="text-[14px] font-semibold text-white">Ready to generate</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-dash-ink-secondary">
        Your Google Ads CSV is validated. The report includes all campaigns with month-to-date performance and
        AI-written insights. To pick specific campaigns or customize metric cards, use Meta or TikTok reporting instead.
      </p>
    </div>
  );
}

/** Step 1 platform selector intro — one line above the three cards. */
export function WizardPlatformSelectorIntro() {
  return (
    <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
      Choose your ad platform first. Meta and TikTok use the same 5-step wizard; Google Ads uses a faster 2-step flow.
      Website traffic (GA4) is a separate report from the client page.
    </p>
  );
}

export function WizardPlatformSummaryLabel({ platform }: { platform: Platform }) {
  return <span className="text-[13px] text-white">{getPlatformLabel(platform)}</span>;
}
