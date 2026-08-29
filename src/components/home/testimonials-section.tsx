const TESTIMONIALS = [
  {
    quote:
      "We used to spend half a day every Monday formatting Meta reports in PowerPoint. NextReport cut that to under 15 minutes for our whole client roster.",
    role: "Founder",
    company: "Performance marketing agency",
    location: "India",
  },
  {
    quote:
      "The AI summaries are actually usable — I edit maybe one sentence and send. Clients notice the polish compared to our old manual decks.",
    role: "Account manager",
    company: "Boutique digital agency",
    location: "UAE",
  },
  {
    quote:
      "Google Slides export plus a share link means I don't chase clients for file downloads anymore. They get a link, they're happy.",
    role: "Freelance media buyer",
    company: "Independent consultant",
    location: "United States",
  },
] as const;

export function TestimonialsSection() {
  return (
    <section className="border-t border-navy-border bg-navy px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-sm font-medium uppercase tracking-widest text-accent">Early users</p>
        <h2 className="mt-3 text-center text-3xl font-semibold text-white">Agencies are shipping reports faster</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-ink-secondary">
          Quotes from beta users. Replace with named testimonials and logos as you collect permission from clients.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <blockquote
              key={t.quote.slice(0, 40)}
              className="rounded-xl border border-navy-border bg-navy-panel p-6 text-sm leading-relaxed text-ink-secondary"
            >
              <p className="text-ink-primary">&ldquo;{t.quote}&rdquo;</p>
              <footer className="mt-4 text-xs text-ink-muted">
                <span className="font-medium text-white">{t.role}</span>
                <span className="block">{t.company}</span>
                <span className="block">{t.location}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
