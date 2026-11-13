import type { ReactNode } from "react";
import Link from "next/link";

/** Compact CTA shown in the report wizard and dashboard when users may need help. */
export function SupportTicketLink({
  clientId,
  reportId,
  className = "",
  openInNewTab = false,
  appearance = "link",
  children = "Raise a support ticket",
}: {
  clientId?: string;
  reportId?: string;
  className?: string;
  openInNewTab?: boolean;
  appearance?: "link" | "button";
  children?: ReactNode;
}) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", clientId);
  if (reportId) params.set("reportId", reportId);
  const href = params.toString() ? `/support?${params}` : "/support";

  return (
    <Link
      href={href}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
      className={`${appearance === "button" ? "inline-flex min-h-10 items-center justify-center rounded-lg border border-dash-border px-3 py-2 text-sm font-medium text-dash-ink hover:bg-dash-card focus-visible:outline-2 focus-visible:outline-dash-accent" : "font-medium text-dash-accent underline hover:no-underline"} ${className}`}
    >
      {children}
    </Link>
  );
}
