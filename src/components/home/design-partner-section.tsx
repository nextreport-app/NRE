import Link from "next/link";
import { DESIGN_PARTNER_PROGRAM } from "@/lib/product-positioning";

export function DesignPartnerSection() {
  const mailHref = `mailto:hello@nextreport.in?subject=${encodeURIComponent(DESIGN_PARTNER_PROGRAM.mailSubject)}`;

  return (
    <section className="border-y border-navy-border bg-navy-panel px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-accent-orange">
          Early access
        </p>
        <h2 className="mt-2 text-center text-2xl font-bold text-white sm:text-3xl">
          {DESIGN_PARTNER_PROGRAM.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-ink-secondary">
          {DESIGN_PARTNER_PROGRAM.subhead}
        </p>

        <ul className="mx-auto mt-8 max-w-xl space-y-3 text-sm text-ink-secondary">
          {DESIGN_PARTNER_PROGRAM.commitments.map((item) => (
            <li key={item} className="flex gap-3 text-left">
              <span className="mt-0.5 text-accent-orange" aria-hidden="true">
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-6 max-w-xl text-center text-xs text-ink-muted">
          {DESIGN_PARTNER_PROGRAM.successNote}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href={mailHref}
            className="rounded-md bg-accent-orange px-6 py-3 text-center text-sm font-semibold text-navy hover:bg-accent-orange-hover"
          >
            {DESIGN_PARTNER_PROGRAM.ctaLabel}
          </a>
          <Link
            href="/design-partners"
            className="rounded-md border border-navy-border px-6 py-3 text-center text-sm font-medium text-white hover:bg-navy"
          >
            Program details
          </Link>
        </div>
      </div>
    </section>
  );
}
