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
        className="group inline-flex min-h-12 items-center gap-3 rounded-xl border border-violet-400/50 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-dash-ink shadow-sm transition hover:border-violet-400 hover:bg-violet-400/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
      >
        <span
          aria-hidden="true"
          className="grid h-7 w-7 place-items-center rounded-lg bg-violet-400/15"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m10 6-6 6 6 6M4 12h16" />
          </svg>
        </span>
        {label}
      </Link>
    </nav>
  );
}
