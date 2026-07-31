import Link from "next/link";

// Placeholder testimonials — replace with real customer quotes once available.
const TESTIMONIALS = [
  {
    quote:
      "NextReport cut our weekly reporting time from 4 hours to under 30 minutes. Our clients love the branded reports.",
    name: "Priya S.",
    detail: "Digital Agency, Mumbai",
  },
  {
    quote:
      "The AI-written campaign summaries save us from having to write the same analysis every week. Game changer.",
    name: "Rahul M.",
    detail: "Performance Marketing Agency, Bangalore",
  },
  {
    quote:
      "Finally a reporting tool that understands Indian agencies. The INR pricing and WhatsApp sharing make it perfect for us.",
    name: "Anika T.",
    detail: "Social Media Agency, Delhi",
  },
];

export function TestimonialsSection() {
  return (
    <section className="bg-navy-panel px-6 py-20">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">Trusted by digital agencies</h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <div key={testimonial.name} className="rounded-xl border border-navy-border bg-navy p-6 text-left">
              <p className="text-sm italic leading-relaxed text-white">&ldquo;{testimonial.quote}&rdquo;</p>
              <p className="mt-4 text-xs text-ink-muted">
                {testimonial.name}, {testimonial.detail}
              </p>
            </div>
          ))}
        </div>

        <Link
          href="/signup"
          className="mt-10 inline-block rounded-md bg-accent-orange px-6 py-3 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
        >
          Start your free trial
        </Link>
      </div>
    </section>
  );
}
