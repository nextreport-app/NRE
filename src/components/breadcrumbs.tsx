import Link from "next/link";
/** Visible hierarchy matching the page's BreadcrumbList JSON-LD. */
export function Breadcrumbs({ current }: { current: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-5 flex items-center justify-center gap-2 text-xs text-ink-muted"
    >
      <Link href="/" className="underline underline-offset-4">
        Home
      </Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{current}</span>
    </nav>
  );
}
