import { SPECIALIST_TIME_SAVINGS_LINE } from "@/lib/product-positioning";

/** ROI strip — placed above “Client reports in three moves”. */
export function SpecialistTimeSavingsSection() {
  return (
    <section className="border-b border-navy-border bg-navy-panel px-6 py-10 sm:py-12">
      <p className="mx-auto max-w-3xl text-center text-base leading-relaxed text-ink-secondary sm:text-lg">
        {SPECIALIST_TIME_SAVINGS_LINE}
      </p>
    </section>
  );
}
