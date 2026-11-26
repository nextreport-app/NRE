import Link from "next/link";
const portfolios = {
  meta: { href: "/performance/meta-ads", label: "All Meta ad accounts" },
  website: { href: "/performance/google-analytics", label: "All websites" },
  seo: { href: "/performance/search-console", label: "All search properties" },
};
/** A dedicated return row, separate from the platform tabs and account controls. */
export function PerformanceBackLink({
  view,
}: {
  view: keyof typeof portfolios;
}) {
  const { href, label } = portfolios[view];
  return (
    <nav aria-label="Portfolio return" className="mb-5">
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dash-border bg-dash-card px-4 py-2 text-sm font-medium text-dash-ink-secondary transition hover:border-dash-accent hover:text-dash-ink focus-visible:outline-2 focus-visible:outline-dash-accent"
      >
        ← {label}
      </Link>
    </nav>
  );
}
