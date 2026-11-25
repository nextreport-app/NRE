import Link from "next/link";
export function clientWorkspaceLinks(
  clientId: string,
  performanceView: "meta" | "website" = "meta",
) {
  return [
    {
      key: "performance",
      label: "Performance",
      href: `${performanceView === "website" ? "/performance/google-analytics" : "/performance/meta-ads"}?client=${encodeURIComponent(clientId)}`,
    },
    {
      key: "generate",
      label: "Generate report",
      href: `/clients/${clientId}/reports/new`,
    },
    {
      key: "schedules",
      label: "Report scheduling",
      href: `/clients/${clientId}/schedules`,
    },
    {
      key: "settings",
      label: "Client settings",
      href: `/clients/${clientId}#client-settings`,
    },
  ];
}
export function ClientWorkspaceNav({
  clientId,
  current,
  performanceView = "meta",
}: {
  clientId: string;
  performanceView?: "meta" | "website";
  current: "performance" | "generate" | "schedules" | "reports" | "settings";
}) {
  return (
    <nav
      aria-label="Client workspace"
      className="my-4 flex flex-wrap gap-1 rounded-xl border border-dash-border bg-dash-card p-1.5"
    >
      {clientWorkspaceLinks(clientId, performanceView).map((link) => (
        <Link
          key={link.key}
          href={link.href}
          aria-current={link.key === current ? "page" : undefined}
          className={`inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-dash-accent ${link.key === current ? "bg-dash-bg text-dash-ink shadow-sm" : "text-dash-ink-secondary hover:bg-dash-bg hover:text-dash-ink"}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
