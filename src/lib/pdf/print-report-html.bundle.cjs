"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/pdf/print-report-html.tsx
var print_report_html_exports = {};
__export(print_report_html_exports, {
  buildPrintReportHtml: () => buildPrintReportHtml
});
module.exports = __toCommonJS(print_report_html_exports);
var import_server = require("react-dom/server");

// src/lib/nre/dates.ts
var IST_OFFSET_MS = 5.5 * 60 * 60 * 1e3;

// src/lib/nre/packs.ts
function pack(id, objective, performanceGoal, slot4, slot5, slot7, slot8, extraPoolExamples) {
  return {
    id,
    objective,
    performanceGoal,
    keys: ["spend", "reach", "impressions", slot4, slot5, "ctr", slot7, slot8],
    extraPoolExamples
  };
}
var LEADS_META_FORM_PACK = pack(
  "leads_meta_form",
  "LEADS",
  "Meta instant form",
  "meta_form_leads",
  "cost_per_lead",
  "link_clicks",
  "cpc_link_click",
  ["frequency", "cpc_all", "landing_page_views", "cost_per_lpv"]
);
var METRIC_PACKS = [
  pack("awareness_reach", "AWARENESS", "Maximise reach of ads", "frequency", "cpm", "cpc_all", "cost_per_1k_reached", ["video_thruplay", "link_clicks", "cpc_link_click"]),
  pack("awareness_impressions", "AWARENESS", "Maximise number of impressions", "cpm", "frequency", "link_clicks", "cpc_link_click", ["video_thruplay"]),
  pack("traffic_link_clicks", "TRAFFIC", "Maximise link clicks", "link_clicks", "cpc_link_click", "landing_page_views", "cost_per_lpv", ["cpc_all", "frequency", "clicks_all"]),
  pack("traffic_landing_page_views", "TRAFFIC", "Maximise landing page views", "landing_page_views", "cost_per_lpv", "link_clicks", "cpc_link_click", ["cpc_all", "frequency"]),
  LEADS_META_FORM_PACK,
  pack("leads_website", "LEADS", "Website lead", "website_leads", "cost_per_website_lead", "landing_page_views", "link_clicks", ["cpc_all", "cpc_link_click", "frequency"]),
  pack("leads_messaging", "LEADS", "Messaging conversations", "messaging_conversations_started", "cost_per_conversation", "new_messaging_contacts", "link_clicks", ["frequency"]),
  pack("sales_purchase", "SALES", "Purchase", "purchases", "cost_per_purchase", "add_to_cart", "results_roas", ["initiate_checkout", "cost_per_add_to_cart", "landing_page_views"]),
  pack("sales_add_to_cart", "SALES", "Add to cart", "add_to_cart", "cost_per_add_to_cart", "initiate_checkout", "purchases", ["results_roas"]),
  pack("sales_initiate_checkout", "SALES", "Initiate checkout", "initiate_checkout", "cost_per_initiate_checkout", "add_to_cart", "purchases", ["results_roas"])
];

// src/lib/nre/slot-assignment.ts
var NEVER_KEYS_FOR_OBJECTIVE = {
  meta_form_leads: ["website_leads", "cost_per_website_lead", "purchases", "cost_per_purchase", "video_views", "thruplays", "app_installs"],
  website_leads: ["meta_form_leads", "cost_per_meta_form_lead", "purchases", "cost_per_purchase", "video_views", "app_installs"],
  leads: ["purchases", "cost_per_purchase", "video_views", "app_installs"],
  purchases: ["website_leads", "meta_form_leads", "cost_per_website_lead", "video_views", "app_installs"],
  initiate_checkout: ["website_leads", "meta_form_leads", "video_views", "app_installs"],
  add_to_cart: ["website_leads", "meta_form_leads", "video_views", "app_installs"],
  link_clicks: ["website_leads", "meta_form_leads", "purchases", "video_views", "app_installs"],
  landing_page_views: ["website_leads", "meta_form_leads", "purchases", "video_views", "app_installs"],
  video_views: ["website_leads", "meta_form_leads", "purchases", "link_clicks", "app_installs"],
  reach: ["website_leads", "meta_form_leads", "purchases", "video_views", "app_installs", "results"],
  awareness: ["website_leads", "meta_form_leads", "purchases", "video_views", "app_installs", "results"],
  messaging: ["website_leads", "purchases", "video_views", "app_installs"],
  app_installs: ["website_leads", "meta_form_leads", "purchases", "video_views"]
};
NEVER_KEYS_FOR_OBJECTIVE.unique_reach = NEVER_KEYS_FOR_OBJECTIVE.reach;
NEVER_KEYS_FOR_OBJECTIVE.mobile_app_installs = NEVER_KEYS_FOR_OBJECTIVE.app_installs;
NEVER_KEYS_FOR_OBJECTIVE.messaging_leads = NEVER_KEYS_FOR_OBJECTIVE.messaging;
NEVER_KEYS_FOR_OBJECTIVE.messaging_conversations_started = NEVER_KEYS_FOR_OBJECTIVE.messaging;
NEVER_KEYS_FOR_OBJECTIVE.conversations = NEVER_KEYS_FOR_OBJECTIVE.messaging;

// src/lib/nre/report-data.ts
var COMBINED_TOTAL_STATIC_HEADERS = [
  "Month",
  "Ad Spend",
  "Reach",
  "Impressions",
  "CTR (All)",
  "CPC (All)"
];
function buildCombinedTotalTableGrid(periodRow, mtdRow, headers) {
  const headerRow = [
    ...COMBINED_TOTAL_STATIC_HEADERS,
    ...headers.resultColumns.flatMap((c) => [c.label, c.costLabel])
  ];
  const dataRow = (row) => {
    const byLabel = new Map(row.resultColumns.map((c) => [c.label, c]));
    const resultCells = headers.resultColumns.flatMap(({ label }) => {
      const col = byLabel.get(label);
      return col ? [col.value, col.cprValue] : ["\u2014", "\u2014"];
    });
    return [row.monthLabel, row.spend, row.reach, row.impressions, row.ctr, row.cpc, ...resultCells];
  };
  return [headerRow, dataRow(periodRow), dataRow(mtdRow)];
}

// src/lib/nre/google-report-data.ts
var GOOGLE_TABLE_STATIC_HEADERS = ["Month", "Cost", "Clicks", "Impressions", "CTR", "Avg. CPC"];
function buildGoogleCombinedTotalTableGrid(mtdRow, headers) {
  const headerRow = [...GOOGLE_TABLE_STATIC_HEADERS, ...headers.resultColumns.flatMap((c) => [c.label, c.costLabel])];
  const emptyPeriodRow = ["\u2014", "\u2014", "\u2014", "\u2014", "\u2014", "\u2014", ...headers.resultColumns.flatMap(() => ["\u2014", "\u2014"])];
  const dataRow = [
    mtdRow.monthLabel,
    mtdRow.spend,
    mtdRow.reach,
    mtdRow.impressions,
    mtdRow.ctr,
    mtdRow.cpc,
    ...mtdRow.resultColumns.flatMap((c) => [c.value, c.cprValue])
  ];
  return [headerRow, emptyPeriodRow, dataRow];
}

// src/lib/pptx/chart-slide-constants.ts
var DONUT_HOLE_RATIO = 0.65;

// src/lib/nre/share-report.ts
function defaultShareVisibility(data) {
  return {
    cover: true,
    overview: true,
    combinedTotal: true,
    metricGuide: true,
    campaigns: Object.fromEntries(data.campaigns.map((c) => [c.campaignName, true])),
    adSets: Object.fromEntries(data.adSets.map((a) => [adSetVisibilityKey(a.campaignName, a.adSetName), true]))
  };
}
function adSetVisibilityKey(campaignName, adSetName) {
  return `${campaignName}\0${adSetName}`;
}
function applyShareVisibility(data) {
  const vis = data.visibility ?? defaultShareVisibility(data);
  return {
    ...data,
    campaigns: data.campaigns.filter((c) => vis.campaigns[c.campaignName] !== false),
    adSets: data.adSets.filter((a) => vis.adSets[adSetVisibilityKey(a.campaignName, a.adSetName)] !== false),
    chart: vis.overview ? data.chart : null,
    visibility: vis
  };
}

// src/components/share-chart-donut.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var HOLE_FILL = "#0d1b2e";
function donutSegmentPath(cx, cy, outerR, innerR, startDeg, endDeg) {
  const toRad = (d) => (d - 90) * Math.PI / 180;
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const sO = { x: cx + outerR * Math.cos(toRad(startDeg)), y: cy + outerR * Math.sin(toRad(startDeg)) };
  const eO = { x: cx + outerR * Math.cos(toRad(endDeg)), y: cy + outerR * Math.sin(toRad(endDeg)) };
  const sI = { x: cx + innerR * Math.cos(toRad(endDeg)), y: cy + innerR * Math.sin(toRad(endDeg)) };
  const eI = { x: cx + innerR * Math.cos(toRad(startDeg)), y: cy + innerR * Math.sin(toRad(startDeg)) };
  return [
    `M ${sO.x.toFixed(2)} ${sO.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${eO.x.toFixed(2)} ${eO.y.toFixed(2)}`,
    `L ${sI.x.toFixed(2)} ${sI.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${eI.x.toFixed(2)} ${eI.y.toFixed(2)}`,
    "Z"
  ].join(" ");
}
function segmentPaths(cx, cy, outerR, innerR, segments) {
  const paths = [];
  let angle = 0;
  for (const seg of segments) {
    const sweep = seg.percentage / 100 * 360;
    if (sweep <= 0) continue;
    const color = `#${seg.color}`;
    if (sweep >= 359.9) {
      paths.push({ d: donutSegmentPath(cx, cy, outerR, innerR, 0, 180), fill: color });
      paths.push({ d: donutSegmentPath(cx, cy, outerR, innerR, 180, 360), fill: color });
      return paths;
    }
    paths.push({ d: donutSegmentPath(cx, cy, outerR, innerR, angle, angle + sweep), fill: color });
    angle += sweep;
  }
  return paths;
}
function ShareChartDonut({
  segments,
  totalSpendLabel,
  size = 220
}) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2;
  const innerR = outerR * DONUT_HOLE_RATIO;
  const paths = segmentPaths(cx, cy, outerR, innerR, segments);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, className: "block", "aria-hidden": "true", children: [
    paths.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: p.d, fill: p.fill }, i)),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx, cy, r: innerR, fill: HOLE_FILL }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "text",
      {
        x: cx,
        y: cy - 4,
        textAnchor: "middle",
        fill: "#ffffff",
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: "22",
        fontWeight: "700",
        children: totalSpendLabel
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "text",
      {
        x: cx,
        y: cy + 16,
        textAnchor: "middle",
        fill: "#e2e8f0",
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: "11",
        fontWeight: "600",
        children: "TOTAL SPEND"
      }
    )
  ] });
}

// src/lib/pptx/metric-icons.ts
function resolveMetricIconId(metric) {
  switch (metric.key) {
    case "spend":
    case "cost":
      return "spend";
    case "reach":
      return "reach";
    case "impressions":
    case "frequency":
      return "impressions";
    case "ctr":
      return "ctr";
    case "cpc_link_click":
    case "avg_cpc":
    case "cpc_all":
      return "cpc";
    case "results":
    case "website_leads":
    case "leads":
    case "link_clicks":
    case "landing_page_views":
    case "purchases":
    case "app_installs":
    case "video_views":
    case "thruplays":
    case "video_p100":
    case "messaging_conversations":
    case "clicks":
    case "conversions":
      return "results";
  }
  if (metric.format === "currency" && metric.perUnitOf) {
    return metric.key.includes("cpc") || metric.key.includes("cpv") || metric.key.includes("cpe") ? "cpc" : "cost";
  }
  if (metric.format === "currency") return "spend";
  if (metric.format === "percentage") return "ctr";
  if (metric.format === "ratio") return "cost";
  if (metric.format === "duration") return "impressions";
  return "results";
}

// src/components/share-report-view.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function reportTypeLabel(data) {
  return data.reportType === "MONTHLY" ? "Monthly Performance Report" : "Weekly Performance Report";
}
var ICON_FILE_BY_CATEGORY = {
  spend: "spend",
  reach: "reach",
  impressions: "impressions",
  results: "results",
  ctr: "ctr",
  cpc: "cpc",
  cost: "cost-per-result"
};
function metricIconFile(metric) {
  return ICON_FILE_BY_CATEGORY[resolveMetricIconId(metric)];
}
var METRIC_EXPLANATIONS = {
  "QUOTE REQUEST SUBMITTED": "Number of quote requests submitted through your ads",
  "WEBSITE LEADS": "Number of leads submitted through your website landing page",
  "META FORM LEADS": "Number of leads submitted through Meta instant forms",
  PURCHASES: "Number of purchases completed through your ads",
  "INITIATE CHECKOUT": "Number of times people began the checkout process",
  "ADD TO CART": "Number of times people added items to their cart",
  "LINK CLICKS": "Number of clicks on links within your ads",
  "LANDING PAGE VIEWS": "Number of times people landed on your website after clicking",
  THRUPLAYS: "Number of times your video was watched to completion or 15 seconds",
  "VIDEO VIEWS": "Number of times your video was watched",
  REACH: "Number of unique people who saw your ad at least once",
  IMPRESSIONS: "Total number of times your ads were displayed",
  "CTR (ALL)": "Percentage of people who clicked after seeing your ad",
  "CPC (ALL)": "Average cost for each click on your ad",
  CPM: "Average cost per 1,000 impressions",
  FREQUENCY: "Average number of times each person saw your ad",
  "MESSAGING CONVERSATIONS": "Number of conversations started through your ads",
  "APP INSTALLS": "Number of times your app was installed through your ads",
  ROAS: "Return on ad spend \u2014 revenue generated for every dollar spent on ads"
};
function getExplanation(label) {
  const known = METRIC_EXPLANATIONS[label];
  if (known) return known;
  const titleCased = label.charAt(0) + label.slice(1).toLowerCase();
  if (label.startsWith("COST PER ")) {
    return `Average cost to achieve each ${label.slice("COST PER ".length).toLowerCase()} through your ads`;
  }
  return `${titleCased} delivered through your ads`;
}
function StatusBadge({ status }) {
  if (!status) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "shrink-0 rounded-full border border-accent-orange/40 bg-accent-orange/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-orange", children: status });
}
function MetricGrid({ metrics, assetBaseUrl = "" }) {
  if (metrics.length === 0) return null;
  const iconPrefix = assetBaseUrl.replace(/\/$/, "");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: metrics.map((m, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "rounded-lg border border-navy-border bg-navy-panel px-3 py-4 text-center", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "img",
      {
        src: `${iconPrefix}/metric-icons/${metricIconFile(m)}.png`,
        alt: "",
        width: 20,
        height: 20,
        className: "mx-auto mb-2 opacity-90"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "truncate text-[10px] font-semibold uppercase tracking-wide text-accent-orange", style: { letterSpacing: "0.5px" }, children: m.label }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mt-1 truncate text-[22px] font-bold text-ink", children: m.value })
  ] }, `${m.key}-${i}`)) });
}
function DateAndFrequency({ dateRange, adFrequency }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mt-1 text-[12px] text-ink-muted", children: [
    dateRange,
    adFrequency && ` \xB7 ${adFrequency}`
  ] });
}
function CardReportTypeLabel({ label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      className: "text-[11px] font-semibold text-ink-muted",
      style: { letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" },
      children: label
    }
  );
}
function AiCopyBlock({ heading, text }) {
  if (!text) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mt-4", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h4", { className: "text-[11px] font-bold uppercase tracking-wide text-accent-orange", children: heading }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mt-1.5 text-[14px] leading-[1.6] text-ink", children: text })
  ] });
}
function SlideCard({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "rounded-lg border border-navy-border bg-navy p-6 shadow-[0_4px_20px_rgba(0,0,0,0.25)] sm:p-8", children });
}
function CampaignCard({
  campaign,
  reportType,
  assetBaseUrl = ""
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(SlideCard, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CardReportTypeLabel, { label: reportType }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { className: "line-clamp-2 text-[20px] font-bold text-ink", children: [
          campaign.campaignName,
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-accent-orange", style: { fontSize: "14px", fontWeight: 400 }, children: [
            " ",
            "(Campaign)"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(StatusBadge, { status: campaign.statusIndicator })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DateAndFrequency, { dateRange: campaign.dateRange, adFrequency: campaign.adFrequency }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "mt-5", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MetricGrid, { metrics: campaign.metrics, assetBaseUrl }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(AiCopyBlock, { heading: "Campaign Summary", text: campaign.aiSummary }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(AiCopyBlock, { heading: "Key Insights & Updates", text: campaign.aiInsights })
  ] });
}
function AdSetCard({
  adSet,
  platform,
  reportType,
  assetBaseUrl = ""
}) {
  const adSetLabel = platform === "GOOGLE" ? " (Ad Group)" : " (Ad Set)";
  const hasAdSetName = adSet.adSetName.length > 0;
  const primaryName = hasAdSetName ? adSet.adSetName : adSet.campaignName;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(SlideCard, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CardReportTypeLabel, { label: reportType }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { className: "line-clamp-2 text-[20px] font-bold text-ink", children: [
          primaryName,
          hasAdSetName && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "#63b3ed", fontSize: "14px", fontWeight: 400 }, children: adSetLabel })
        ] }),
        hasAdSetName && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mt-0.5 text-[13px] text-ink-muted", children: adSet.campaignName })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(StatusBadge, { status: adSet.statusIndicator })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DateAndFrequency, { dateRange: adSet.dateRange, adFrequency: adSet.adFrequency }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "mt-5", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MetricGrid, { metrics: adSet.metrics, assetBaseUrl }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(AiCopyBlock, { heading: "Campaign Summary", text: adSet.aiSummary }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(AiCopyBlock, { heading: "Key Insights & Updates", text: adSet.aiInsights })
  ] });
}
function VisualResultBar({
  name,
  color,
  resultLine,
  costLine,
  barPct
}) {
  const widthPct = Math.max(barPct > 0 ? 4 : 0, barPct);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)] items-center gap-3", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "truncate text-right text-[9px] text-ink", children: name }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "h-[18px] overflow-hidden rounded bg-[#1e293b]", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "h-full rounded", style: { width: `${widthPct}%`, backgroundColor: `#${color}` } }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "truncate text-[9px] font-bold text-ink", children: [
      resultLine,
      " \xB7 ",
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "font-medium text-[#94a3b8]", children: costLine })
    ] })
  ] });
}
function VisualMiniDonut({
  name,
  spendLabel,
  pctLabel,
  color
}) {
  const size = 90;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = size / 2;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex w-[90px] flex-col items-center", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: size, height: size, "aria-hidden": "true", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: c, cy: c, r, fill: "none", stroke: `#${color}`, strokeWidth: stroke }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("text", { x: c, y: c + 4, textAnchor: "middle", fill: "#ffffff", fontSize: "10", fontWeight: "700", children: spendLabel })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mt-1 w-full truncate text-center text-[9px] text-ink", children: name }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-[9px] text-[#94a3b8]", children: pctLabel })
  ] });
}
function ShareMtdOverviewSlide({ chart }) {
  const model = chart.visualSlide;
  if (!model) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(SlideCard, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { className: "text-center text-[24px] font-bold text-ink", children: model.title }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mt-5 grid grid-cols-1 gap-4 min-[720px]:grid-cols-[320px_1fr]", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "rounded-lg border border-navy-border p-4", style: { backgroundColor: "#111f35" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]", children: model.leftHeading }),
        model.isMultiObjective && model.groupedDonut ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mt-4 space-y-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "relative mx-auto h-[168px] w-[168px]", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            ShareChartDonut,
            {
              segments: model.groupedDonut.map((s) => ({
                name: s.name,
                spendLabel: s.spendLabel,
                percentage: s.percentage,
                color: s.color
              })),
              totalSpendLabel: model.groupedDonutCenterLabel,
              size: 168
            }
          ) }),
          model.groupedDonut.map((seg) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "truncate text-[9px] text-ink", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "mr-2 inline-block h-2.5 w-2.5 rounded-sm", style: { backgroundColor: `#${seg.color}` } }),
            seg.name,
            " \xB7 ",
            seg.spendLabel,
            " \xB7 ",
            seg.percentage,
            "%"
          ] }, seg.name))
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "mt-4 flex flex-wrap justify-center gap-4", children: model.miniDonuts.map((donut) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(VisualMiniDonut, { ...donut }, donut.name)) }),
        !model.isMultiObjective ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "mt-4 text-center text-[11px] font-bold text-ink", children: [
          "Total MTD Spend: ",
          model.groupedDonutCenterLabel
        ] }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "rounded-lg border border-navy-border p-4", style: { backgroundColor: "#111f35" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]", children: model.rightHeading }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "mt-4 space-y-3", children: model.resultBars.map((bar) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(VisualResultBar, { ...bar }, bar.name)) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mt-5 text-center text-[11px] text-[#94a3b8]", children: model.summaryLine })
  ] });
}
function CombinedTotalTable({ data }) {
  const grid = data.platform === "GOOGLE" ? buildGoogleCombinedTotalTableGrid(data.mtdRow, data.tableHeaderLabels) : buildCombinedTotalTableGrid(data.periodRow, data.mtdRow, data.tableHeaderLabels);
  const hidePeriodRow = data.reportType === "MONTHLY" || !data.periodRow.hasData;
  const hideMtdRow = !hidePeriodRow && data.periodRow.sameMonthAsCurrentMTD;
  const [headerRow, periodRow, mtdRow] = grid;
  const bodyRows = [
    ...hidePeriodRow ? [] : [{ cells: periodRow, isPeriod: true }],
    ...hideMtdRow ? [] : [{ cells: mtdRow, isPeriod: false }]
  ];
  if (bodyRows.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-2", children: [
    data.combinedTotalStory ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-center text-[16px] leading-snug text-ink", style: { marginBottom: "12px" }, children: data.combinedTotalStory }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "overflow-x-auto rounded-lg border border-navy-border", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("table", { className: "w-full min-w-[640px] border-collapse text-left text-[13px]", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("tr", { className: "bg-navy-border", children: headerRow.map((h, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { className: "whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink", children: h }, i)) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("tbody", { children: bodyRows.map((row, ri) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("tr", { className: row.isPeriod ? "bg-navy-panel" : "bg-navy", children: row.cells.map((cell, ci) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "td",
        {
          className: "whitespace-nowrap px-4 py-3 text-[13px] text-ink " + (ci === 0 ? "text-left font-semibold" : "text-center"),
          children: cell
        },
        ci
      )) }, ri)) })
    ] }) })
  ] });
}
function MetricGuideSection({ metricGuide }) {
  if (metricGuide.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(SlideCard, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { className: "text-[22px] font-bold text-ink", children: "Metric Abbreviation Guide" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2", children: metricGuide.map((entry, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-[12px] font-bold uppercase tracking-wide text-accent-orange", children: entry.term }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mt-1 text-[11px] leading-[1.5] text-ink-muted", children: getExplanation(entry.term) })
    ] }, `${entry.term}-${i}`)) })
  ] });
}
function ShareReportView({
  data,
  shareToken,
  mode = "share",
  assetBaseUrl = ""
}) {
  const isPrint = mode === "print";
  const slideClass = isPrint ? "print-slide mb-0" : "mb-6";
  const visibleData = applyShareVisibility(data);
  const generatedDate = new Date(visibleData.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const adSets = visibleData.adSets ?? [];
  const chart = visibleData.chart ?? null;
  const metricGuide = visibleData.metricGuide ?? [];
  const showCombinedTotal = visibleData.visibility?.combinedTotal !== false;
  const showMetricGuide = visibleData.visibility?.metricGuide !== false;
  const showOverview = visibleData.visibility?.overview !== false;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      id: isPrint ? "share-report-print" : "share-report-page",
      className: isPrint ? "bg-navy" : "min-h-screen",
      style: isPrint ? { fontFamily: "var(--font-inter), sans-serif", backgroundColor: "#0d1b2e" } : {
        fontFamily: "var(--font-inter), sans-serif",
        backgroundColor: "#0d1b2e",
        backgroundImage: "radial-gradient(circle, #1e3a5f 1px, transparent 1px)",
        backgroundSize: "32px 32px"
      },
      children: [
        !isPrint ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "header",
          {
            className: "sticky top-0 z-10 border-b border-navy-border px-4 sm:px-6",
            style: { backgroundColor: "#0d1b2e", minHeight: "60px" },
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mx-auto flex max-w-[960px] items-center justify-between gap-3", style: { minHeight: "60px" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("img", { src: "/logo.png", alt: "NextReport logo", style: { height: "40px", width: "40px", display: "block" } }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[20px] font-bold text-ink", style: { fontFamily: "var(--font-inter), sans-serif" }, children: "NextReport" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "hidden text-[14px] text-white sm:inline", children: "Powered by NextReport" }),
                shareToken ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "a",
                  {
                    href: `/api/r/${shareToken}/download`,
                    className: "flex items-center rounded-md border border-accent-orange px-4 text-[13px] font-semibold text-white hover:bg-accent-orange/10",
                    style: { backgroundColor: "#1e293b", height: "44px" },
                    children: "Download PPTX"
                  }
                ) : null,
                shareToken && visibleData.publishedAt ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "a",
                  {
                    href: `/api/r/${shareToken}/download-pdf`,
                    className: "flex items-center rounded-md border border-[#63b3ed] px-4 text-[13px] font-semibold text-white hover:bg-[#63b3ed]/10",
                    style: { backgroundColor: "#1e293b", height: "44px" },
                    children: "Download PDF"
                  }
                ) : null
              ] })
            ] })
          }
        ) : null,
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("main", { className: isPrint ? "mx-auto max-w-[960px] px-6 py-4" : "mx-auto max-w-[960px] px-4 py-6 sm:px-6", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: slideClass, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "mx-auto aspect-video w-full max-w-2xl rounded-lg border border-navy-border bg-navy-panel px-6 py-8 shadow-[0_4px_20px_rgba(0,0,0,0.25)] sm:px-10 sm:py-10", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex h-full flex-col items-center justify-center text-center", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                "div",
                {
                  className: "inline-flex items-center gap-2 rounded-full",
                  style: { backgroundColor: "#1e293b", border: "1px solid #334155", padding: "4px 12px" },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "span",
                      {
                        className: "h-2 w-2 shrink-0 rounded-full",
                        style: { backgroundColor: visibleData.platform === "GOOGLE" ? "#4285F4" : "#1877F2" }
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[11px] font-semibold uppercase", style: { color: "#94a3b8", letterSpacing: "2px" }, children: visibleData.platform === "GOOGLE" ? "GOOGLE ADS" : "META ADS" })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h1", { className: "mt-4 line-clamp-2 text-[32px] font-bold text-ink", children: visibleData.accountName }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mt-2 text-[16px] tracking-wide text-ink-muted", children: reportTypeLabel(visibleData).toUpperCase() }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mt-2 text-[14px] text-ink-muted", children: visibleData.cover.dateRange }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "my-5 h-px w-24 bg-navy-border" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-[14px] font-medium text-ink", children: visibleData.cover.healthBadge }),
              visibleData.cover.budgetSummary && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mt-2 text-[13px] text-ink-muted", children: visibleData.cover.budgetSummary })
            ] }) }),
            visibleData.isPaused && visibleData.pausedMessage && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "mx-auto mt-4 max-w-2xl rounded-md border border-navy-border bg-navy-panel px-4 py-3 text-center text-[13px] text-ink-muted", children: visibleData.pausedMessage })
          ] }),
          visibleData.campaigns.map((c) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("section", { className: slideClass, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CampaignCard, { campaign: c, reportType: reportTypeLabel(visibleData), assetBaseUrl }) }, `campaign-${c.campaignName}`)),
          adSets.map((a, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("section", { className: slideClass, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(AdSetCard, { adSet: a, platform: visibleData.platform, reportType: reportTypeLabel(visibleData), assetBaseUrl }) }, `adset-${a.campaignName}-${a.adSetName}-${i}`)),
          showOverview && chart && chart.donutSegments && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("section", { className: slideClass, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ShareMtdOverviewSlide, { chart }) }),
          showCombinedTotal && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("section", { className: slideClass, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(SlideCard, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { className: "mb-4 text-[22px] font-bold text-ink", children: "Monthly Campaign Performance Overview" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CombinedTotalTable, { data: visibleData })
          ] }) }),
          showMetricGuide && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("section", { className: slideClass, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MetricGuideSection, { metricGuide }) })
        ] }),
        !isPrint && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("footer", { style: { textAlign: "center", padding: "32px 24px", borderTop: "1px solid #1e3a5f", marginTop: "40px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { color: "#94a3b8", fontSize: "12px" }, children: "This report was generated using NextReport \xB7 nextreport.in" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { color: "#64748b", fontSize: "11px", marginTop: "4px" }, children: [
            "Generated on ",
            generatedDate
          ] })
        ] })
      ]
    }
  );
}

// src/lib/pdf/print-report-css.ts
var PRINT_REPORT_CSS = `
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

// src/lib/pdf/app-base-url.ts
function appBaseUrl() {
  if (process.env.VERCEL_ENV === "production") {
    return "https://nextreport.in";
  }
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://127.0.0.1:3000";
}

// src/lib/pdf/print-report-html.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function buildPrintReportHtml(share) {
  const body = (0, import_server.renderToStaticMarkup)(
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ShareReportView, { data: share, mode: "print", assetBaseUrl: appBaseUrl() })
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${PRINT_REPORT_CSS}</style>
</head>
<body>${body}</body>
</html>`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildPrintReportHtml
});
