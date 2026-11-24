"use client";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import Link from "next/link";
export function WizardClientActions({
  clientId,
  showSchedule,
  performance,
  changeClientLabel,
  onChangeClientClick,
}: {
  clientId: string;
  showSchedule: boolean;
  performance?: "meta" | "website";
  changeClientLabel: string;
  onChangeClientClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sideOffset, setSideOffset] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !menu.current || !root.current) return;
      const buttonEdge = trigger.current.getBoundingClientRect().right;
      // Put the flyout past the form content so it does not cover wizard text.
      const formEdge =
        trigger.current.closest(".nre-report-wizard")?.getBoundingClientRect()
          .right ?? buttonEdge;
      const left = Math.max(buttonEdge, formEdge) + 12;
      const width = menu.current.getBoundingClientRect().width;
      setSideOffset(
        left + width <= document.documentElement.clientWidth - 16
          ? left - root.current.getBoundingClientRect().left
          : null,
      );
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const item =
    "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-dash-ink transition hover:bg-dash-bg focus-visible:outline-2 focus-visible:outline-dash-accent";
  const tools = [
    ...(performance
      ? [
          {
            href: `${performance === "website" ? "/websites" : "/overview"}?client=${encodeURIComponent(clientId)}`,
            label: "Performance (Meta Ads & GA4)",
          },
        ]
      : []),
    ...(showSchedule
      ? [{ href: `/clients/${clientId}/schedules`, label: "Schedule reports" }]
      : []),
    { href: `/clients/${clientId}/reports`, label: "Report history" },
    { href: `/clients/${clientId}#client-settings`, label: "Client settings" },
  ];
  return (
    <div
      ref={root}
      className="relative shrink-0"
      onBlur={(e) => {
        if (
          e.relatedTarget &&
          !e.currentTarget.contains(e.relatedTarget as Node)
        )
          setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dash-border bg-dash-bg px-3 py-2 text-xs font-semibold text-dash-ink shadow-sm transition hover:border-dash-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent"
      >
        Client actions
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <nav
          ref={menu}
          id={id}
          aria-label="Client actions"
          style={sideOffset !== null ? { left: sideOffset } : undefined}
          className={`absolute z-40 w-72 max-w-[calc(100vw-6rem)] rounded-xl border border-dash-border bg-dash-card p-1.5 shadow-xl ${sideOffset !== null ? "top-0" : "right-0 top-full mt-2"}`}
        >
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              target="_blank"
              rel="noopener noreferrer"
              className={item}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              {tool.label}
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-dash-ink-secondary"
              >
                <path d="M15 3h6v6M21 3 10 14" />
                <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
              </svg>
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
          ))}
          <div className="my-1 border-t border-dash-border" />
          <Link
            href="/clients"
            className={item}
            onClick={(e) => {
              onChangeClientClick?.(e);
              setOpen(false);
            }}
          >
            {changeClientLabel}
          </Link>
        </nav>
      )}
    </div>
  );
}
