/**
 * CSV / spreadsheet marketing & wizard icons (stroke icons, currentColor).
 */

type IconProps = { className?: string; title?: string };

const base = "h-6 w-6 shrink-0";

/** File tab + CSV label block */
export function IconCsvFile({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <path
        d="M8 4h8l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M16 4v4h4" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <rect x="7" y="13" width="10" height="5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8.5 15.2h1.1M10.8 15.2h1.1M13.1 15.2h1.1M8.5 16.8h1.1M10.8 16.8h1.1M13.1 16.8h1.1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Plain data grid */
export function IconCsvGrid({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect x="4" y="5" width="16" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 10h16M4 14h16M10 5v14M15 5v14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Upload into spreadsheet */
export function IconCsvUpload({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect x="5" y="9" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 13h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 3v6M9.5 5.5 12 3l2.5 2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/** Download / export CSV */
export function IconCsvDownload({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect x="5" y="5" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 15v5M9.5 17.5 12 20l2.5-2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/** Row-based sheet (Ads Manager export feel) */
export function IconCsvRows({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <path
        d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M6 9h12M6 12h12M6 15h12M6 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Verification / parity check */
export function IconCsvVerify({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect x="4" y="6" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 10h5M7 13h5M7 16h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="17.5" cy="16.5" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 16.5l1.1 1.1 2.2-2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Header row + columns (report table) */
export function IconCsvTable({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect x="3" y="6" width="18" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
      <path d="M9 6v13M15 6v13" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Comma-separated hint (abstract) */
export function IconCsvComma({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <text x="12" y="15" textAnchor="middle" fill="currentColor" fontSize="8" fontFamily="ui-monospace, monospace">
        ,,,
      </text>
    </svg>
  );
}

/** API + CSV hybrid (manual export path) */
export function IconCsvHybrid({ className, title }: IconProps) {
  return (
    <svg className={`${base} ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect x="3" y="8" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M5 11h6M5 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M16 6v4M14 8h4M19 14a3 3 0 1 1-6 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const CSV_ICONS = {
  file: IconCsvFile,
  grid: IconCsvGrid,
  upload: IconCsvUpload,
  download: IconCsvDownload,
  rows: IconCsvRows,
  verify: IconCsvVerify,
  table: IconCsvTable,
  comma: IconCsvComma,
  hybrid: IconCsvHybrid,
} as const;

export type CsvIconId = keyof typeof CSV_ICONS;
