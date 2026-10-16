import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function FeatureUploadIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 4 4m-4-4-4 4" />
      <path strokeLinecap="round" d="M4 20h16" />
    </IconBase>
  );
}

export function FeatureCalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M8 3v4M16 3v4M3 10h18" />
    </IconBase>
  );
}

export function FeatureTargetIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </IconBase>
  );
}

export function FeatureSparkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.2 4.2L17 8l-3.8 1.8L12 14l-1.2-4.2L7 8l3.8-1.8L12 3z" />
      <path strokeLinecap="round" d="M5 19l.8-2.8M19 19l-.8-2.8" />
    </IconBase>
  );
}

export function FeatureCompareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path strokeLinecap="round" d="M8 7h12M8 12h12M8 17h8" />
      <path strokeLinecap="round" d="M4 7h.01M4 12h.01M4 17h.01" />
    </IconBase>
  );
}

export function FeatureShareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path strokeLinecap="round" d="M8.5 10.5 15.5 6.5M8.5 13.5l7 3.5" />
    </IconBase>
  );
}

const FEATURE_ICONS = [
  FeatureUploadIcon,
  FeatureCalendarIcon,
  FeatureTargetIcon,
  FeatureSparkIcon,
  FeatureCompareIcon,
  FeatureShareIcon,
] as const;

export function HomeFeatureIcon({ index, className }: { index: number; className?: string }) {
  const Icon = FEATURE_ICONS[index] ?? FeatureSparkIcon;
  return <Icon className={className ?? "h-5 w-5 text-accent-orange"} />;
}
