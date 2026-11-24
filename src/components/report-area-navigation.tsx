import Link from "next/link";
export function ReportAreaNavigation({
  current,
}: {
  current: "history" | "scheduled";
}) {
  return (
    <nav aria-label="Report area" className="mb-5 flex flex-wrap gap-2">
      {[
        { key: "history", href: "/reports", label: "All reports" },
        {
          key: "scheduled",
          href: "/reports?tab=scheduled",
          label: "Scheduled drafts",
        },
      ].map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={current === item.key ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-dash-accent ${current === item.key ? "border-dash-accent bg-dash-accent text-[#102033]" : "border-dash-border bg-dash-card text-dash-ink-secondary hover:text-dash-ink"}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
