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
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-dash-accent px-5 py-3 text-sm font-semibold text-[#102033] shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent"
      >
        <span
          aria-hidden="true"
          className="inline-flex shrink-0"
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
