"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
type ActionIcon = "performance" | "schedule" | "report" | "manage";
export function clientCardActions(clientId: string, scheduling = false) {
  return [
    {
      href: `/performance/meta-ads?client=${encodeURIComponent(clientId)}`,
      label: "Performance (Meta Ads & GA4)",
      icon: "performance" as ActionIcon,
    },
    {
      href: `/clients/${clientId}/${scheduling ? "reports/new" : "schedules"}`,
      label: scheduling ? "Generate report" : "Schedule reports",
      icon: (scheduling ? "report" : "schedule") as ActionIcon,
    },
    {
      href: `/clients/${clientId}`,
      label: "Manage client",
      icon: "manage" as ActionIcon,
    },
  ];
}
function ActionIcon({ type }: { type: ActionIcon }) {
  return (
    <svg
      aria-hidden="true"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {type === "performance" ? (
        <>
          <path d="M4 5v14h16" />
          <path d="m7 14 4-4 4 2 5-7" />
        </>
      ) : type === "schedule" ? (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4m10-4v4M3 11h18m-12 4h3" />
        </>
      ) : type === "report" ? (
        <>
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path d="M14 3v6h6M8 13h8m-8 4h5" />
        </>
      ) : (
        <>
          <path d="M4 7h16M4 17h16" />
          <circle cx="9" cy="7" r="3" />
          <circle cx="15" cy="17" r="3" />
        </>
      )}
    </svg>
  );
}
export function ClientCardActions({
  clientId,
  clientName,
  scheduling,
  open,
  onToggle,
  onClose,
}: {
  clientId: string;
  clientName: string;
  scheduling: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !panel.current) return;
      const r = trigger.current.getBoundingClientRect(),
        box = panel.current.getBoundingClientRect();
      const width = document.documentElement.clientWidth,
        height = window.innerHeight;
      const top =
        r.bottom + 8 + box.height <= height - 12
          ? r.bottom + 8
          : Math.max(12, r.top - box.height - 8);
      setPosition({
        top: Math.min(top, Math.max(12, height - box.height - 12)),
        left: Math.max(
          12,
          Math.min(r.right - box.width, width - box.width - 12),
        ),
      });
    };
    place();
    panel.current
      ?.querySelector<HTMLAnchorElement>("a")
      ?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!root.current?.contains(target) && !panel.current?.contains(target))
        onClose();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, onClose]);
  return (
    <div
      ref={root}
      className="flex shrink-0 justify-end max-[359px]:w-full"
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (
          next &&
          !root.current?.contains(next) &&
          !panel.current?.contains(next)
        )
          onClose();
      }}
      onKeyDown={(e) => {
        if (open && e.key === "Escape") {
          e.stopPropagation();
          onClose();
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`Client actions for ${clientName}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dash-border bg-dash-bg px-3 py-2 text-xs font-semibold text-dash-ink shadow-sm transition hover:border-dash-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent"
      >
        Client actions
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={open ? "rotate-180" : ""}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div className="nre-app-shell">
            <nav
              ref={panel}
              id={id}
              aria-label={`Actions for ${clientName}`}
              style={position ?? undefined}
              className="fixed z-50 max-h-[calc(100dvh-1.5rem)] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-dash-border bg-dash-card p-1.5 shadow-xl"
            >
              {clientCardActions(clientId, scheduling).map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={onClose}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-dash-ink transition hover:bg-dash-bg focus-visible:outline-2 focus-visible:outline-dash-accent"
                >
                  <ActionIcon type={action.icon} />
                  <span>{action.label}</span>
                </Link>
              ))}
            </nav>
          </div>,
          document.body,
        )}
    </div>
  );
}
