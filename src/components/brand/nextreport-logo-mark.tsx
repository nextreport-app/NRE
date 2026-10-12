"use client";

import { useCallback, useId, useRef, useState } from "react";

export type NextReportLogoVariant =
  | "classic"
  | "amber-cap"
  | "amber-center"
  | "merged-right"
  | "premium-rounded";

type Props = {
  className?: string;
  size?: number;
  /** Cursor-style tilt + bar lift on hover (disable for static export contexts). */
  interactive?: boolean;
  variant?: NextReportLogoVariant;
  title?: string;
};

const NAVY = "#0d1b2e";
const AMBER = "#f5b45a";

/**
 * Compact hex + ascending bars mark (Build step). Right bar aligns with hex interior —
 * interactive tilt mimics cursor.com header logo motion.
 */
export function NextReportLogoMark({
  className,
  size = 48,
  interactive = true,
  variant = "classic",
  title = "NextReport",
}: Props) {
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

  const barRx = variant === "premium-rounded" ? 1.4 : 0.8;
  const hexJoin = variant === "premium-rounded" ? "round" : "miter";
  const mergedRight = variant === "merged-right";

  const barFill = (which: "left" | "mid" | "right") => {
    if (variant === "amber-center" && which === "mid") return AMBER;
    return NAVY;
  };

  const capAmber = variant === "amber-cap";

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
          stroke={NAVY}
          strokeWidth={mergedRight ? 2 : 2.25}
          strokeLinejoin={hexJoin}
          fill="none"
        />
        <g>
          <rect x="16" y="76" width="70" height="3.2" rx="0.6" fill={NAVY} />
          <rect x="18" y="54" width="11" height="22" rx={barRx} fill={barFill("left")} />
          <rect
            x="33"
            y="44"
            width="11"
            height="32"
            rx={barRx}
            fill={barFill("mid")}
            style={{
              transition: "transform 280ms ease",
              transform: hovering && interactive ? "scaleY(1.04)" : "scaleY(1)",
              transformOrigin: "38.5px 76px",
            }}
          />
          <rect
            x={mergedRight ? 75 : 73}
            y="26"
            width="13"
            height="50"
            rx={barRx}
            fill={barFill("right")}
            style={{
              transition: "transform 280ms ease",
              transform: hovering && interactive ? "scaleY(1.05)" : "scaleY(1)",
              transformOrigin: "79.5px 76px",
            }}
          />
          {capAmber ? (
            <rect x={mergedRight ? 75 : 73} y="26" width="13" height="3.5" rx="0.5" fill={AMBER} />
          ) : null}
        </g>
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
