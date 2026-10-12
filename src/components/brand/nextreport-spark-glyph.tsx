/**
 * NextReport spark — Claude-style radiating pinwheel category, original geometry
 * (uneven rays, round caps). Not Anthropic’s mark; tuned for hex icon scale.
 */

type Ray = { deg: number; len: number; stroke: number };

/** Hand-tuned rays: off-grid angles/lengths for a natural burst read at ~48px. */
const SPARK_RAYS: Ray[] = [
  { deg: -92, len: 21, stroke: 3.5 },
  { deg: -58, len: 15.5, stroke: 3.1 },
  { deg: -24, len: 22.5, stroke: 3.7 },
  { deg: 8, len: 14, stroke: 2.9 },
  { deg: 38, len: 20, stroke: 3.4 },
  { deg: 68, len: 16.5, stroke: 3.2 },
  { deg: 102, len: 23, stroke: 3.8 },
  { deg: 138, len: 13.5, stroke: 2.8 },
  { deg: 168, len: 19, stroke: 3.3 },
  { deg: -148, len: 17, stroke: 3.1 },
];

function rayLine(deg: number, len: number, cx: number, cy: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x2: cx + len * Math.cos(rad),
    y2: cy + len * Math.sin(rad),
  };
}

type Props = {
  color: string;
  cx?: number;
  cy?: number;
  scale?: number;
  rotateDeg?: number;
};

export function NextReportSparkGlyph({ color, cx = 50, cy = 50, scale = 1, rotateDeg = 0 }: Props) {
  return (
    <g
      transform={`translate(${cx} ${cy}) rotate(${rotateDeg}) scale(${scale}) translate(${-cx} ${-cy})`}
      stroke={color}
      strokeLinecap="round"
      fill="none"
    >
      {SPARK_RAYS.map((ray, i) => {
        const { x2, y2 } = rayLine(ray.deg, ray.len, cx, cy);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            strokeWidth={ray.stroke}
          />
        );
      })}
    </g>
  );
}

/** Static SVG fragment for export assets (same rays). */
export function sparkGlyphSvgContent(glyphFill: string): string {
  const lines = SPARK_RAYS.map((ray) => {
    const { x2, y2 } = rayLine(ray.deg, ray.len, 50, 50);
    return `<line x1="50" y1="50" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${glyphFill}" stroke-width="${ray.stroke}" stroke-linecap="round"/>`;
  }).join("\n    ");
  return lines;
}
