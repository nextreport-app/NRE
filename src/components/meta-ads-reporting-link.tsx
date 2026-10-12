import type { ReactNode } from "react";
import {
  META_ADS_MANAGER_REPORTING,
  type MetaAdsReportingLinkVariant,
} from "@/lib/nre/meta-csv-export-guide";

const variantClass: Record<MetaAdsReportingLinkVariant, string> = {
  inline: "font-medium text-dash-accent underline decoration-dash-accent/50 underline-offset-2 hover:text-[#fbd38d]",
  button:
    "nre-meta-reporting-btn inline-flex items-center justify-center rounded-md border border-[#1877f2]/40 bg-[#1877f2]/10 px-3 py-2 text-[13px] font-semibold text-[#93c5fd] hover:bg-[#1877f2]/20",
  help: "font-semibold text-accent-orange underline decoration-accent-orange/50 underline-offset-2 hover:text-[#fbd38d]",
};

export function MetaAdsReportingLink({
  variant = "inline",
  className = "",
  children,
}: {
  variant?: MetaAdsReportingLinkVariant;
  className?: string;
  children?: ReactNode;
}) {
  const label = children ?? META_ADS_MANAGER_REPORTING.linkLabel;
  return (
    <a
      href={META_ADS_MANAGER_REPORTING.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${variantClass[variant]} ${className}`.trim()}
    >
      {label}
    </a>
  );
}
