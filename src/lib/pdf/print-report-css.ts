/** Self-contained styles for PDF capture — mirrors globals.css tokens used by ShareReportView. */
export const PRINT_REPORT_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #0d1b2e;
    color: #ffffff;
    font-family: Inter, system-ui, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .print-slide {
    break-after: page;
    page-break-after: always;
    break-inside: avoid;
    page-break-inside: avoid;
    padding: 8px 0 24px;
  }
  .print-slide:last-child {
    break-after: auto;
    page-break-after: auto;
  }
  .bg-navy { background-color: #0d1b2e; }
  .bg-navy-panel { background-color: #111f35; }
  .bg-navy-border { background-color: #1e3a5f; }
  .border-navy-border { border-color: #1e3a5f; }
  .text-ink { color: #ffffff; }
  .text-ink-muted { color: #94a3b8; }
  .text-accent-orange { color: #f5b45a; }
  .border-accent-orange\\/40 { border-color: rgba(245, 180, 90, 0.4); }
  .bg-accent-orange\\/15 { background-color: rgba(245, 180, 90, 0.15); }
  .rounded-lg { border-radius: 8px; }
  .rounded-md { border-radius: 8px; }
  .rounded-full { border-radius: 9999px; }
  .rounded-sm { border-radius: 2px; }
  .border { border-width: 1px; border-style: solid; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .font-medium { font-weight: 500; }
  .uppercase { text-transform: uppercase; }
  .tracking-wide { letter-spacing: 0.025em; }
  .text-center { text-align: center; }
  .text-left { text-align: left; }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .grid { display: grid; }
  .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .gap-3 { gap: 12px; }
  .gap-6 { gap: 24px; }
  .gap-2 { gap: 8px; }
  .gap-2\\.5 { gap: 10px; }
  .flex { display: flex; }
  .inline-flex { display: inline-flex; }
  .items-center { align-items: center; }
  .items-start { align-items: flex-start; }
  .justify-center { justify-content: center; }
  .justify-between { justify-content: space-between; }
  .flex-wrap { flex-wrap: wrap; }
  .flex-col { flex-direction: column; }
  .shrink-0 { flex-shrink: 0; }
  .min-w-0 { min-width: 0; }
  .break-words { overflow-wrap: break-word; }
  .block { display: block; }
  .relative { position: relative; }
  .mx-auto { margin-left: auto; margin-right: auto; }
  .w-full { width: 100%; }
  .min-w-\\[640px\\] { min-width: 640px; }
  .max-w-2xl { max-width: 672px; }
  .max-w-\\[960px\\] { max-width: 960px; }
  .aspect-video { aspect-ratio: 16 / 9; }
  .overflow-x-auto { overflow-x: auto; }
  .border-collapse { border-collapse: collapse; }
  .whitespace-nowrap { white-space: nowrap; }
  .space-y-2\\.5 > :not([hidden]) ~ :not([hidden]) { margin-top: 10px; }
  .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 8px; }
  .mt-1 { margin-top: 4px; }
  .mt-1\\.5 { margin-top: 6px; }
  .mt-4 { margin-top: 16px; }
  .mt-5 { margin-top: 20px; }
  .mt-6 { margin-top: 24px; }
  .mb-2 { margin-bottom: 8px; }
  .mb-4 { margin-bottom: 16px; }
  .my-5 { margin-top: 20px; margin-bottom: 20px; }
  .px-3 { padding-left: 12px; padding-right: 12px; }
  .px-4 { padding-left: 16px; padding-right: 16px; }
  .px-6 { padding-left: 24px; padding-right: 24px; }
  .py-3 { padding-top: 12px; padding-bottom: 12px; }
  .py-4 { padding-top: 16px; padding-bottom: 16px; }
  .py-8 { padding-top: 32px; padding-bottom: 32px; }
  .p-6 { padding: 24px; }
  .h-2 { height: 8px; }
  .w-2 { width: 8px; }
  .h-3\\.5 { height: 14px; }
  .w-3\\.5 { width: 14px; }
  .h-px { height: 1px; }
  .w-24 { width: 96px; }
  .opacity-90 { opacity: 0.9; }
  .text-\\[10px\\] { font-size: 10px; line-height: 1.25; }
  .text-\\[11px\\] { font-size: 11px; line-height: 1.35; }
  .text-\\[12px\\] { font-size: 12px; line-height: 1.4; }
  .text-\\[13px\\] { font-size: 13px; line-height: 1.45; }
  .text-\\[14px\\] { font-size: 14px; line-height: 1.5; }
  .text-\\[15px\\] { font-size: 15px; line-height: 1.5; }
  .text-\\[16px\\] { font-size: 16px; line-height: 1.5; }
  .text-\\[20px\\] { font-size: 20px; line-height: 1.3; }
  .text-\\[22px\\] { font-size: 22px; line-height: 1.25; }
  .text-\\[24px\\] { font-size: 24px; line-height: 1.25; }
  .text-\\[32px\\] { font-size: 32px; line-height: 1.15; }
  .leading-\\[1\\.6\\] { line-height: 1.6; }
  .leading-snug { line-height: 1.375; }
  .leading-\\[1\\.5\\] { line-height: 1.5; }
  .shadow-\\[0_4px_20px_rgba\\(0\\,0\\,0\\,0\\.25\\)\\] {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  }
  @media (min-width: 720px) {
    .min-\\[720px\\]\\:grid-cols-\\[220px_1fr\\] {
      grid-template-columns: 220px 1fr;
    }
  }
  .sm\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .sm\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sm\\:px-6 { padding-left: 24px; padding-right: 24px; }
  .sm\\:px-10 { padding-left: 40px; padding-right: 40px; }
  .sm\\:py-10 { padding-top: 40px; padding-bottom: 40px; }
  .sm\\:p-8 { padding: 32px; }
`;

/** Extra styles for chart-only Puppeteer capture — ShareMtdOverviewSlide classes not in PRINT_REPORT_CSS. */
export const CHART_SLIDE_CAPTURE_CSS = `
  ${PRINT_REPORT_CSS}
  html, body {
    margin: 0;
    padding: 0;
    background: transparent !important;
  }
  #chart-slide-capture {
    width: 960px;
    height: 540px;
    overflow: hidden;
    box-sizing: border-box;
    background: transparent;
  }
  #chart-slide-capture > .chart-slide-card {
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
  .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .grid-cols-\\[minmax\\(0\\,1\\.2fr\\)_minmax\\(0\\,1\\.4fr\\)_minmax\\(88px\\,0\\.8fr\\)\\] {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.4fr) minmax(88px, 0.8fr);
  }
  .space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: 12px; }
  .pt-1 { padding-top: 4px; }
  .h-4 { height: 16px; }
  .h-full { height: 100%; }
  .overflow-hidden { overflow: hidden; }
  .rounded { border-radius: 4px; }
  .tabular-nums { font-variant-numeric: tabular-nums; }
  .text-right { text-align: right; }
  .sm\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  @media (min-width: 720px) {
    .min-\\[720px\\]\\:mx-0 { margin-left: 0; margin-right: 0; }
  }
`;
