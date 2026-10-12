"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useSiteTheme } from "@/components/site-theme-provider";
import {
  colorSchemeForSurface,
  LOGO_PALETTES,
  type NextReportLogoColorScheme,
} from "@/components/brand/logo-color-schemes";
import {
  NextReportAbstractGlyph,
  type AbstractGlyphId,
} from "@/components/brand/nextreport-abstract-glyphs";
import { NextReportSparkGlyph } from "@/components/brand/nextreport-spark-glyph";

export type { AbstractGlyphId };
export type HexGlyphId = "n" | "spark" | AbstractGlyphId;

export type NextReportLogoVariant =
  | "classic"
  | "amber-cap"
  | "amber-center"
  | "merged-right"
  | "premium-rounded"
  /** Bars + baseline touch hex on bottom, left, and upper-right (Cursor-style fit). */
  | "triple-touch"
  /** Solid navy hex; bars and baseline in off-white (Cursor inverse). */
  | "filled-inverse"
  /** Filled hex + white geometric N (with baseline). */
  | "filled-inverse-n"
  /** Filled hex + white N, no baseline. */
  | "filled-inverse-n-plain"
  /** Filled hex + white N, rounded strokes, no baseline. */
  | "filled-inverse-n-rounded"
  /** Filled hex + white N, compact triple-touch anchors. */
  | "filled-inverse-n-touch"
  /** Final mark: bold typographic N in hex (use with colorScheme). */
  | "filled-n"
  /** Final mark: spark burst in hex (Claude-style category, original shape). */
  | "filled-spark"
  /** Final mark: original abstract symbol (see `abstractGlyph`). */
  | "filled-abstract";

type Props = {
  className?: string;
  size?: number;
  /** Cursor-style tilt + bar lift on hover (disable for static export contexts). */
  interactive?: boolean;
  variant?: NextReportLogoVariant;
  /** Light/dark surface palettes; `auto` follows site theme. */
  colorScheme?: NextReportLogoColorScheme | "auto";
  /** Larger N, Cursor-style fill inside hex. */
  compact?: boolean;
  /** With `filled-abstract` — which symbol to draw. */
  abstractGlyph?: AbstractGlyphId;
  title?: string;
};

const NAVY = "#0d1b2e";
const AMBER = "#f5b45a";
const INK_ON_FILL = "#f7f7f4";

/** Shared bar layout; triple-touch uses tighter anchors to the hex interior. */
const LAYOUT = {
  classic: {
    baseline: { x: 16, y: 76, w: 70, h: 3.2 },
    bars: [
      { x: 18, y: 54, w: 11, h: 22 },
      { x: 33, y: 44, w: 11, h: 32 },
      { x: 73, y: 26, w: 13, h: 50 },
    ],
  },
  tripleTouch: {
    baseline: { x: 14, y: 71.2, w: 72, h: 2.8 },
    bars: [
      { x: 14, y: 54, w: 11.5, h: 17.2 },
      { x: 28.5, y: 42, w: 11.5, h: 29.2 },
      { x: 72.5, y: 22, w: 13.5, h: 49.2 },
    ],
  },
} as const;

type NGlyphStyle = "block" | "rounded" | "touch";

function typographicMarkN(glyphFill: string, compact: boolean) {
  const fontSize = compact ? 62 : 54;
  const y = compact ? 71.5 : 68;
  return (
    <text
      x="50"
      y={y}
      textAnchor="middle"
      fill={glyphFill}
      fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
      fontSize={fontSize}
      fontWeight={700}
      letterSpacing="-0.04em"
    >
      N
    </text>
  );
}

function filledNGlyph(style: NGlyphStyle, showBaseline: boolean, glyphFill = INK_ON_FILL) {
  const rx = style === "rounded" ? 1.6 : 0.8;
  const touch = style === "touch";
  const left = touch ? { x: 14, y: 22, w: 12.5, h: 50.5 } : { x: 15, y: 24, w: 12, h: showBaseline ? 46.5 : 48.5 };
  const right = touch
    ? { x: 73, y: 22, w: 12.5, h: 50.5 }
    : { x: 73, y: 24, w: 12, h: showBaseline ? 46.5 : 48.5 };
  const diag = touch
    ? "26.5,22 39,22 85.5,72.5 73,72.5"
    : showBaseline
      ? "27,24 39,24 85,70.5 73,70.5"
      : "26.5,22 39,22 85.5,72.5 73,72.5";

  return (
    <g fill={glyphFill}>
      {showBaseline ? (
        <rect x={14} y={71.2} width={72} height={2.8} rx="0.5" />
      ) : null}
      <rect x={left.x} y={left.y} width={left.w} height={left.h} rx={rx} />
      <rect x={right.x} y={right.y} width={right.w} height={right.h} rx={rx} />
      <polygon points={diag} />
    </g>
  );
}

/**
 * Compact hex + ascending bars mark (Build step). Right bar aligns with hex interior —
 * interactive tilt mimics cursor.com header logo motion.
 */
export function NextReportLogoMark({
  className,
  size = 48,
  interactive = true,
  variant = "classic",
  colorScheme = "auto",
  compact = true,
  abstractGlyph = "forward",
  title = "NextReport",
}: Props) {
  const { resolvedTheme } = useSiteTheme();
  const uid = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLSpanElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, lift: 0 });
  const [hovering, setHovering] = useState(false);

  const resetTilt = useCallback(() => {
    setHovering(false);
    setTilt({ rx: 0, ry: 0, lift: 0 });
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!interactive || !rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      setTilt({
        rx: -ny * 14,
        ry: nx * 16,
        lift: Math.min(6, Math.hypot(nx, ny) * 10),
      });
    },
    [interactive],
  );

  const barRx = variant === "premium-rounded" ? 1.4 : 0.6;
  const hexJoin = variant === "premium-rounded" ? "round" : "miter";
  const mergedRight = variant === "merged-right";
  const filledInverse = variant === "filled-inverse";
  const filledFinalMark =
    variant === "filled-n" || variant === "filled-spark" || variant === "filled-abstract";
  const filledNVariant =
    filledFinalMark
      ? null
      :
    variant === "filled-inverse-n"
      ? { style: "block" as NGlyphStyle, baseline: true }
      : variant === "filled-inverse-n-plain"
        ? { style: "block" as NGlyphStyle, baseline: false }
        : variant === "filled-inverse-n-rounded"
          ? { style: "rounded" as NGlyphStyle, baseline: false }
          : variant === "filled-inverse-n-touch"
            ? { style: "touch" as NGlyphStyle, baseline: false }
            : null;
  const filledHex = filledInverse || filledNVariant !== null || filledFinalMark;
  const resolvedScheme: NextReportLogoColorScheme =
    colorScheme === "auto" ? colorSchemeForSurface(resolvedTheme) : colorScheme;
  const palette = filledFinalMark ? LOGO_PALETTES[resolvedScheme] : null;
  const sparkRotate = hovering && interactive && variant === "filled-spark" ? tilt.ry * 0.85 : 0;
  const tripleTouch = variant === "triple-touch" || filledInverse;

  const layout = tripleTouch ? LAYOUT.tripleTouch : LAYOUT.classic;
  const [barL, barM, barR] = layout.bars;
  const rightBar = mergedRight && !tripleTouch ? { ...barR, x: 75 } : barR;

  const barFill = (which: "left" | "mid" | "right") => {
    if (filledHex && !filledNVariant) return INK_ON_FILL;
    if (variant === "amber-center" && which === "mid") return AMBER;
    return NAVY;
  };

  const capAmber = variant === "amber-cap";
  const baselineFill = filledHex && !filledNVariant ? INK_ON_FILL : NAVY;

  return (
    <span
      ref={rootRef}
      className={["relative inline-flex shrink-0 select-none", interactive && "cursor-pointer", className]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size, perspective: interactive ? 520 : undefined }}
      onPointerEnter={() => interactive && setHovering(true)}
      onPointerMove={onPointerMove}
      onPointerLeave={resetTilt}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      <span
        className="block size-full"
        style={{
          transformStyle: interactive ? "preserve-3d" : undefined,
          transition: interactive ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
          transform: interactive
            ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${-tilt.lift}px)`
            : undefined,
        }}
      >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block overflow-visible"
      >
        <polygon
          points="50,4 88,26 88,74 50,96 12,74 12,26"
          stroke={
            palette
              ? palette.hexStroke === "none"
                ? "none"
                : palette.hexStroke
              : filledHex
                ? "none"
                : NAVY
          }
          strokeWidth={
            palette ? palette.hexStrokeWidth : mergedRight && !tripleTouch ? 2 : 2.25
          }
          strokeLinejoin={hexJoin}
          fill={palette ? palette.hexFill : filledHex ? NAVY : "none"}
        />
        {palette?.accent && resolvedScheme === "on-light-amber-ring" ? (
          <circle cx="50" cy="11" r="2.2" fill={palette.accent} />
        ) : null}
        {filledFinalMark && palette && variant === "filled-spark" ? (
          <NextReportSparkGlyph
            color={palette.glyphFill}
            scale={compact ? 1.08 : 0.95}
            rotateDeg={sparkRotate}
          />
        ) : filledFinalMark && palette && variant === "filled-abstract" ? (
          <NextReportAbstractGlyph id={abstractGlyph} color={palette.glyphFill} />
        ) : filledFinalMark && palette ? (
          typographicMarkN(palette.glyphFill, compact)
        ) : filledNVariant ? (
          filledNGlyph(filledNVariant.style, filledNVariant.baseline)
        ) : (
          <g>
            <rect
              x={layout.baseline.x}
              y={layout.baseline.y}
              width={layout.baseline.w}
              height={layout.baseline.h}
              rx="0.5"
              fill={baselineFill}
            />
            <rect x={barL.x} y={barL.y} width={barL.w} height={barL.h} rx={barRx} fill={barFill("left")} />
            <rect
              x={barM.x}
              y={barM.y}
              width={barM.w}
              height={barM.h}
              rx={barRx}
              fill={barFill("mid")}
              style={{
                transition: "transform 280ms ease",
                transform: hovering && interactive ? "scaleY(1.04)" : "scaleY(1)",
                transformOrigin: `${barM.x + barM.w / 2}px ${layout.baseline.y}px`,
              }}
            />
            <rect
              x={rightBar.x}
              y={rightBar.y}
              width={rightBar.w}
              height={rightBar.h}
              rx={barRx}
              fill={barFill("right")}
              style={{
                transition: "transform 280ms ease",
                transform: hovering && interactive ? "scaleY(1.05)" : "scaleY(1)",
                transformOrigin: `${rightBar.x + rightBar.w / 2}px ${layout.baseline.y}px`,
              }}
            />
            {capAmber ? (
              <rect x={rightBar.x} y={rightBar.y} width={rightBar.w} height="3.5" rx="0.5" fill={AMBER} />
            ) : null}
          </g>
        )}
        {variant === "amber-center" ? (
          <defs>
            <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={AMBER} stopOpacity="0" />
              <stop offset="100%" stopColor={AMBER} stopOpacity={hovering ? 0.12 : 0} />
            </linearGradient>
          </defs>
        ) : null}
        {variant === "amber-center" ? (
          <polygon points="50,4 88,26 88,74 50,96 12,74 12,26" fill={`url(#${uid}-sheen)`} />
        ) : null}
      </svg>
      </span>
    </span>
  );
}
