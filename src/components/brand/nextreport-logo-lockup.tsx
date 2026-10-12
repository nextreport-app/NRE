"use client";

import { resolveHexMark } from "@/components/brand/hex-glyph-utils";
import { NextReportLogoMark, type HexGlyphId } from "@/components/brand/nextreport-logo-mark";
import { CURSOR_CREAM, NEXTREPORT_NAVY } from "@/components/brand/cursor-brand-colors";
import { useSiteTheme } from "@/components/site-theme-provider";

type Props = {
  /** Force light or dark lockup; `auto` follows site theme. */
  mode?: "light" | "dark" | "auto";
  /** Hex icon: n, spark, or abstract (forward, fold, ascend, orbit, pulse, stack). */
  iconGlyph?: HexGlyphId;
  /** Icon size in px (wordmark scales with icon). */
  iconSize?: number;
  className?: string;
  interactive?: boolean;
};

/**
 * Final horizontal lockup — Cursor cream (#f7f7f4) + NextReport navy (#0d1b2e).
 * Light: navy hex + cream glyph + navy wordmark. Dark: cream hex + navy glyph + cream wordmark.
 */
export function NextReportLogoLockup({
  mode = "auto",
  iconGlyph = "n",
  iconSize = 48,
  className = "",
  interactive = true,
}: Props) {
  const { resolvedTheme } = useSiteTheme();
  const surface = mode === "auto" ? resolvedTheme : mode;
  const isLight = surface === "light";

  const wordmarkColor = isLight ? NEXTREPORT_NAVY : CURSOR_CREAM;
  const fontSize = Math.round(iconSize * 0.375);
  const mark = resolveHexMark(iconGlyph);

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`.trim()}>
      <NextReportLogoMark
        size={iconSize}
        variant={mark.variant}
        abstractGlyph={mark.abstractGlyph}
        colorScheme={isLight ? "final-light" : "final-dark"}
        compact
        interactive={interactive}
      />
      <span
        className="font-sans font-semibold leading-none tracking-[-0.02em]"
        style={{ color: wordmarkColor, fontSize }}
      >
        NextReport
      </span>
    </span>
  );
}
