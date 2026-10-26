"use client";

import Link from "next/link";

export function TestimonialsSection() {
  return (
    <section className="border-t border-navy-border bg-navy px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-sm font-medium uppercase tracking-widest text-accent">Agency pilot</p>
        <h2 className="mt-3 text-center text-3xl font-semibold text-white">Try it with a report you already know</h2>
        <div className="mx-auto mt-6 max-w-2xl text-center text-ink-secondary">
          <p>Bring a Meta Ads CSV and a previous client report. Compare the numbers, review the deck, and tell us what your agency needs before making it part of your workflow.</p>
          <Link href="/book-demo" className="mt-6 inline-flex rounded-md bg-accent px-5 py-3 font-semibold text-navy">Book a reporting walkthrough</Link>
        </div>
      </div>
    </section>
  );
}
