/**
 * SVG renderer for the MTD Overview slide — mirrors share-report-view.tsx's
 * MtdOverviewSlide layout so PPT/Google Slides match the live browser link.
 */

import type { ShareChartData } from "../nre/share-report";

const INK = "#ffffff";
const INK_MUTED = "#94a3b8";
const ACCENT_ORANGE = "#f6ad55";
const KPI_BG = "#131d30";
const KPI_BORDER = "#1e293b";
const HOLE_FILL = "#0d1b2e";
/** Matches share page SlideCard / bg-navy — full opaque slide background for PNG embed. */
const SLIDE_BG = "#0d1b2e";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Donut ring segment path — angles in degrees, 0° = top, clockwise. */
function donutSegmentPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
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
    "Z",
  ].join(" ");
}

export function buildMtdOverviewSvg(chart: ShareChartData): string {
  const W = 960;
  const H = 540;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<rect width="${W}" height="${H}" fill="${SLIDE_BG}"/>`,
  );

  // Title + subtitle (match browser hierarchy)
  parts.push(
    `<text x="${W / 2}" y="48" text-anchor="middle" fill="${INK}" font-family="Poppins" font-size="24" font-weight="700">${escapeXml(chart.title)}</text>`,
    `<text x="${W / 2}" y="72" text-anchor="middle" fill="${INK_MUTED}" font-family="Poppins" font-size="14">${escapeXml(chart.subtitle)}</text>`,
  );

  // KPI tiles — 4 across
  const kpiY = 92;
  const kpiW = 200;
  const kpiH = 88;
  const kpiGap = 16;
  const kpiStartX = (W - (4 * kpiW + 3 * kpiGap)) / 2;
  const kpiTiles = [
    { value: chart.snapshot.mtdSpendLabel, label: "MTD AD SPEND" },
    { value: chart.snapshot.primaryResultsValue, label: chart.snapshot.primaryResultsLabel.toUpperCase() },
    { value: chart.snapshot.primaryCprValue, label: chart.snapshot.primaryCprLabel.toUpperCase() },
    { value: chart.snapshot.budgetPctUsed || "—", label: chart.snapshot.budgetPctUsed ? "BUDGET USED" : "BUDGET" },
  ];
  kpiTiles.forEach((tile, i) => {
    const x = kpiStartX + i * (kpiW + kpiGap);
    parts.push(
      `<rect x="${x}" y="${kpiY}" width="${kpiW}" height="${kpiH}" rx="8" fill="${KPI_BG}" stroke="${KPI_BORDER}" stroke-width="1"/>`,
      `<text x="${x + kpiW / 2}" y="${kpiY + 38}" text-anchor="middle" fill="${INK}" font-family="Poppins" font-size="22" font-weight="700">${escapeXml(tile.value)}</text>`,
      `<text x="${x + kpiW / 2}" y="${kpiY + 62}" text-anchor="middle" fill="${ACCENT_ORANGE}" font-family="Poppins" font-size="10" font-weight="600">${escapeXml(tile.label)}</text>`,
    );
  });

  // Donut + legend
  const donutCx = 220;
  const donutCy = 310;
  const outerR = 110;
  const innerR = outerR * 0.52;

  let angle = 0;
  for (const seg of chart.donutSegments) {
    const sweep = (seg.percentage / 100) * 360;
    if (sweep <= 0) continue;
    const start = angle;
    const end = angle + sweep;
    parts.push(
      `<path d="${donutSegmentPath(donutCx, donutCy, outerR, innerR, start, end)}" fill="#${seg.color}"/>`,
    );
    angle = end;
  }

  // Center hole cover (matches browser mask)
  parts.push(`<circle cx="${donutCx}" cy="${donutCy}" r="${innerR}" fill="${HOLE_FILL}"/>`);
  parts.push(
    `<text x="${donutCx}" y="${donutCy - 4}" text-anchor="middle" fill="${INK}" font-family="Poppins" font-size="22" font-weight="700">${escapeXml(chart.totalSpendLabel)}</text>`,
    `<text x="${donutCx}" y="${donutCy + 16}" text-anchor="middle" fill="${INK_MUTED}" font-family="Poppins" font-size="10" font-weight="600">TOTAL MTD</text>`,
  );

  // Legend
  let legendY = 220;
  const legendX = 380;
  for (const seg of chart.donutSegments) {
    parts.push(
      `<rect x="${legendX}" y="${legendY}" width="14" height="14" rx="2" fill="#${seg.color}"/>`,
      `<text x="${legendX + 22}" y="${legendY + 12}" fill="${INK}" font-family="Poppins" font-size="13">${escapeXml(`${seg.name} · ${seg.percentage}% · ${seg.spendLabel}`)}</text>`,
    );
    legendY += 28;
  }

  const insight =
    `${chart.snapshot.activeCampaignCount} active campaign${chart.snapshot.activeCampaignCount === 1 ? "" : "s"} MTD` +
    (chart.snapshot.budgetPctUsed ? ` · ${chart.snapshot.budgetPctUsed} of monthly budget used` : "");
  parts.push(
    `<text x="${W / 2}" y="488" text-anchor="middle" fill="${INK_MUTED}" font-family="Poppins" font-size="12">${escapeXml(insight)}</text>`,
  );

  parts.push("</svg>");
  return parts.join("");
}
