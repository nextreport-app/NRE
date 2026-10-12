/**
 * Inline SVG marketing icons — navy/cream tokens match site theme.
 * Use stroke="currentColor" inside `text-ink` / `text-ink-secondary` parents.
 */

type IconProps = { className?: string; title?: string };

const base = "h-6 w-6 shrink-0";

export function IconConnect({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <path
        d="M4 14l4-8 4 5 4-9 4 12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="6" r="1.5" fill="currentColor" />
    </svg>
  );
}

export { IconCsvUpload } from "@/components/marketing/csv-icons";

export function IconApiSync({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <path
        d="M7 8h10a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M17 6v4h-4M7 18v-4h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconWizard({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <path d="M5 19l3-10 4 2 6-8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M14 3l2 2-2 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="18" cy="5" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function IconChartSlide({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 15V11M11 15V9M15 15V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconPptExport({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 16h8M8 12h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M16 17v3M14 19h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconShare({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <circle cx="18" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8.5 11l7-3M8.5 13l7 3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function IconClients({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="17" cy="10" r="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M15 19c.3-2 1.8-3.5 4-3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconDigest({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M7 13h4M7 16h7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconGenerate({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <path d="M13 3L5 14h6l-1 7 9-12h-6l1-6z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

export function IconObjectives({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 5V3M12 21v-2M5 12H3M21 12h-2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconWhiteLabel({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 10h8M8 13h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export const MARKETING_ICONS = {
  connect: IconConnect,
  csvUpload: IconCsvUpload,
  apiSync: IconApiSync,
  wizard: IconWizard,
  chartSlide: IconChartSlide,
  pptExport: IconPptExport,
  share: IconShare,
  clients: IconClients,
  digest: IconDigest,
  generate: IconGenerate,
  objectives: IconObjectives,
  whiteLabel: IconWhiteLabel,
} as const;
