/**
 * Small leading icons for wizard / marketing metric chips (currentColor, 16–20px).
 */

import type { ReactNode } from "react";

type IconProps = { className?: string; title?: string };

const sm = "h-4 w-4 shrink-0";

function Svg({ className, title, children }: IconProps & { children: ReactNode }) {
  return (
    <svg className={`${sm} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconMetricSpend(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v18M8 7h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

export function IconMetricImpressions(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.75" />
    </Svg>
  );
}

export function IconMetricReach(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 4a8 8 0 0 1 8 8M12 20a8 8 0 0 1-8-8M4 12h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconMetricResults(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconMetricCost(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

export function IconMetricCtr(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 8h10v8H7z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconMetricClicks(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 5l6 6-3 3 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconMetricCpm(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 18V6M8 18v-8M12 18V4M16 18v-5M20 18v-10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

export function IconMetricFrequency(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity="0.35" />
      <path d="M8 8c2 2 2 6 0 8M16 8c-2 2-2 6 0 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

export function IconMetricLeads(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="9" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 19c0-3 2.5-5 6-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M16 11h5M18.5 8.5v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

export function IconMetricLpv(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="4" width="14" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 8h8M8 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 15v3M10 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconMetricVideo(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M10 10l5 2-5 2v-4z" fill="currentColor" />
    </Svg>
  );
}

export function IconMetricMessaging(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 6h14v10H9l-4 3V6z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M8 10h8M8 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconMetricRoas(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 17l5-6 4 3 7-9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 5h3v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

export function IconMetricEngagement(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20s-6-4.5-6-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.5-6 9-6 9z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconMetricGeneric(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 12h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

export function IconMetricChipAdd(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.75" strokeDasharray="3 2" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

const KEY_RESOLVERS: { test: (k: string) => boolean; Icon: (p: IconProps) => ReactNode }[] = [
  { test: (k) => k === "spend", Icon: IconMetricSpend },
  { test: (k) => k === "impressions", Icon: IconMetricImpressions },
  { test: (k) => k === "reach" || k.includes("1k_reached"), Icon: IconMetricReach },
  { test: (k) => k === "results" || k.startsWith("results_"), Icon: IconMetricResults },
  { test: (k) => k.startsWith("cost_per") || k.includes("cpc"), Icon: IconMetricCost },
  { test: (k) => k === "ctr" || k.includes("_ctr"), Icon: IconMetricCtr },
  { test: (k) => k.includes("click") || k.includes("outbound"), Icon: IconMetricClicks },
  { test: (k) => k === "cpm", Icon: IconMetricCpm },
  { test: (k) => k === "frequency", Icon: IconMetricFrequency },
  { test: (k) => k.includes("lead") || k.includes("application") || k.includes("appointment"), Icon: IconMetricLeads },
  { test: (k) => k.includes("lpv") || k.includes("landing_page"), Icon: IconMetricLpv },
  { test: (k) => k.includes("video") || k.includes("thruplay") || k.includes("play"), Icon: IconMetricVideo },
  { test: (k) => k.includes("messag") || k.includes("conversation"), Icon: IconMetricMessaging },
  { test: (k) => k.includes("roas") || k.includes("purchase") || k.includes("add_to_cart"), Icon: IconMetricRoas },
  { test: (k) => k.includes("engagement") || k.includes("_like") || k.includes("interaction"), Icon: IconMetricEngagement },
];

/** Resolve dictionary `key` (e.g. spend, cost_per_lead) to a chip icon. */
export function MetricChipIcon({
  metricKey,
  className,
  title,
}: {
  metricKey: string;
  className?: string;
  title?: string;
}) {
  const k = metricKey.toLowerCase();
  const match = KEY_RESOLVERS.find((r) => r.test(k));
  const Icon = match?.Icon ?? IconMetricGeneric;
  return <Icon className={className} title={title} />;
}

export const METRIC_CHIP_ICONS = {
  spend: IconMetricSpend,
  impressions: IconMetricImpressions,
  reach: IconMetricReach,
  results: IconMetricResults,
  cost: IconMetricCost,
  ctr: IconMetricCtr,
  clicks: IconMetricClicks,
  cpm: IconMetricCpm,
  frequency: IconMetricFrequency,
  leads: IconMetricLeads,
  lpv: IconMetricLpv,
  video: IconMetricVideo,
  messaging: IconMetricMessaging,
  roas: IconMetricRoas,
  engagement: IconMetricEngagement,
  generic: IconMetricGeneric,
  chipAdd: IconMetricChipAdd,
} as const;
