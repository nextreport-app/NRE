"use client";

import type { ReactNode } from "react";
import {
  Ga4BrandIcon,
  GoogleAdsBrandIcon,
  MetaAdsBrandIcon,
  TikTokAdsBrandIcon,
} from "@/components/platform-brand-icons";
import { isLaunchPlatformEnabled } from "@/lib/meta-launch-scope";
import { wizardPlatformImportDescription } from "../utils";
import { ReportTypeCard } from "./report-type-card";

export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WizardPlatformPickerGrid({
  selectedPlatformCard,
  onChoosePlatform,
  onChooseWebsitePlatform,
  showTikTokOption = true,
}: {
  showTikTokOption?: boolean;
  selectedPlatformCard: "META" | "GOOGLE" | "TIKTOK" | null;
  onChoosePlatform: (next: "META" | "GOOGLE" | "TIKTOK") => void;
  onChooseWebsitePlatform?: () => void;
}) {
  const showGoogleAds = isLaunchPlatformEnabled("GOOGLE");
  const showTikTokAds = isLaunchPlatformEnabled("TIKTOK");
  const showGa4Website = isLaunchPlatformEnabled("GA4");
  const multiColumn = showGoogleAds || showTikTokAds || showGa4Website;

  return (
    <div className={`grid grid-cols-1 gap-3 ${multiColumn ? "sm:grid-cols-2 lg:grid-cols-4" : "max-w-md"}`}>
      <ReportTypeCard
        icon={<MetaAdsBrandIcon />}
        heading="Meta Ads"
        description={wizardPlatformImportDescription("META")}
        selected={selectedPlatformCard === "META"}
        onSelect={() => onChoosePlatform("META")}
        singleLineHeading
      />
      {showGoogleAds ? (
        <ReportTypeCard
          icon={<GoogleAdsBrandIcon />}
          heading="Google Ads"
          description={wizardPlatformImportDescription("GOOGLE")}
          selected={selectedPlatformCard === "GOOGLE"}
          onSelect={() => onChoosePlatform("GOOGLE")}
          singleLineHeading
        />
      ) : null}
      {showTikTokAds && showTikTokOption ? (
        <ReportTypeCard
          icon={<TikTokAdsBrandIcon />}
          heading="TikTok Ads"
          description={wizardPlatformImportDescription("TIKTOK")}
          selected={selectedPlatformCard === "TIKTOK"}
          onSelect={() => onChoosePlatform("TIKTOK")}
          singleLineHeading
        />
      ) : null}
      {showGa4Website && onChooseWebsitePlatform ? (
        <ReportTypeCard
          icon={<Ga4BrandIcon />}
          heading="Google Analytics"
          description="Website traffic — sessions, channels, and landing pages"
          selected={false}
          onSelect={onChooseWebsitePlatform}
          singleLineHeading
        />
      ) : null}
    </div>
  );
}

export function WizardPlatformCompactBar({
  icon,
  heading,
  description,
  expanded,
  onToggle,
  allowPlatformChange = true,
}: {
  icon: ReactNode;
  heading: string;
  description: string;
  expanded: boolean;
  onToggle: () => void;
  /** False during Meta-only launch — compact bar without “Change platform”. */
  allowPlatformChange?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dash-border bg-dash-bg/70 px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="inline-flex shrink-0 rounded-md border border-dash-border bg-dash-card p-2"
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug text-dash-ink">{heading}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-dash-ink-secondary">{description}</p>
        </div>
      </div>
      {allowPlatformChange ? (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-dash-border bg-dash-card px-3 py-1.5 text-[13px] font-medium text-dash-ink-secondary transition-colors hover:border-white/20 hover:bg-dash-border hover:text-dash-ink"
          aria-expanded={expanded}
        >
          Change platform
          <ChevronDownIcon
            className={`h-3.5 w-3.5 opacity-80 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      ) : null}
    </div>
  );
}
