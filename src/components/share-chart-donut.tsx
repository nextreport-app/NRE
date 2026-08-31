/**
 * SVG donut ring for the live share page — same geometry as PPT OOXML
 * (outer diameter 220, inner = outer × DONUT_HOLE_RATIO) and chart-overview-svg.
 */

import type { ShareDonutSegment } from "@/lib/nre/share-report";
import { DONUT_HOLE_RATIO } from "@/lib/pptx/chart-slide-constants";

const HOLE_FILL = "#0d1b2e";

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

function segmentPaths(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  segments: ShareDonutSegment[],
): { d: string; fill: string }[] {
  const paths: { d: string; fill: string }[] = [];
  let angle = 0;
  for (const seg of segments) {
    const sweep = (seg.percentage / 100) * 360;
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

export function ShareChartDonut({
  segments,
  totalSpendLabel,
  size = 220,
}: {
  segments: ShareDonutSegment[];
  totalSpendLabel: string;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2;
  const innerR = outerR * DONUT_HOLE_RATIO;
  const paths = segmentPaths(cx, cy, outerR, innerR, segments);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block" aria-hidden="true">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill} />
      ))}
      <circle cx={cx} cy={cy} r={innerR} fill={HOLE_FILL} />
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="var(--font-inter), sans-serif"
        fontSize="22"
        fontWeight="700"
      >
        {totalSpendLabel}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        fill="#e2e8f0"
        fontFamily="var(--font-inter), sans-serif"
        fontSize="11"
        fontWeight="600"
      >
        TOTAL SPEND
      </text>
    </svg>
  );
}
