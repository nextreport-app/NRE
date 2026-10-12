/** Original abstract marks for the final hex icon (not letter, not Claude spark). */

export type AbstractGlyphId = "forward" | "fold" | "ascend" | "orbit" | "pulse" | "stack";

type Props = { id: AbstractGlyphId; color: string };

export function NextReportAbstractGlyph({ id, color }: Props) {
  switch (id) {
    case "forward":
      /* Next / forward — bold chevron wedge upper-right */
      return (
        <path
          fill={color}
          d="M28 58 L28 42 L52 32 L52 44 L68 44 L68 56 L52 56 L52 68 Z"
        />
      );
    case "fold":
      /* Report page — rectangle + folded corner triangle */
      return (
        <g fill={color}>
          <path d="M30 68 V32 h34 v22 h-14 v14 Z" />
          <path d="M54 32 h16 v16 L54 32 Z" opacity="0.45" />
        </g>
      );
    case "ascend":
      /* Growth without bar chart — three dots on a diagonal */
      return (
        <g fill={color}>
          <circle cx="34" cy="62" r="5.5" />
          <circle cx="46" cy="50" r="6.5" />
          <circle cx="62" cy="36" r="7.5" />
        </g>
      );
    case "orbit":
      /* Cycle / rhythm — ring + satellite dot */
      return (
        <g fill="none" stroke={color}>
          <ellipse cx="50" cy="50" rx="22" ry="14" strokeWidth="3.2" transform="rotate(-24 50 50)" />
          <circle cx="68" cy="38" r="5" fill={color} stroke="none" />
        </g>
      );
    case "pulse":
      /* Signal — single smooth arch stroke */
      return (
        <path
          fill="none"
          stroke={color}
          strokeWidth="4.2"
          strokeLinecap="round"
          d="M26 58 C34 58 38 34 50 34 S66 58 74 58"
        />
      );
    case "stack":
      /* Deck / slides — three offset slabs */
      return (
        <g fill={color}>
          <rect x="26" y="38" width="44" height="7" rx="1.2" />
          <rect x="30" y="48" width="44" height="7" rx="1.2" />
          <rect x="34" y="58" width="44" height="7" rx="1.2" />
        </g>
      );
    default:
      return null;
  }
}

export const ABSTRACT_GLYPH_LABELS: Record<AbstractGlyphId, string> = {
  forward: "Forward chevron (next)",
  fold: "Page fold (report)",
  ascend: "Ascending dots (growth)",
  orbit: "Orbit (cadence)",
  pulse: "Pulse arc (signal)",
  stack: "Slide stack (deck)",
};
