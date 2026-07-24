import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — NextReport",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link href="/" className="text-sm text-accent hover:underline">
        ← Back to NextReport
      </Link>

      <h1 className="mt-6 text-3xl font-semibold text-white">About NextReport</h1>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-secondary">
        <p>
          NextReport is an automated ad reporting tool built for digital agencies
          managing Meta Ads and Google Ads accounts. We started NextReport in 2026
          after seeing how much time agency teams lost every week rebuilding the same
          client reports by hand — copying numbers out of Ads Manager, formatting
          slides, and writing up the same kinds of insights over and over.
        </p>

        <p>
          NextReport automates that work. Upload your Meta Ads or Google Ads export,
          and NextReport detects the columns, calculates the metrics that matter, and
          generates a fully branded PowerPoint report — ready to send to your client
          in minutes instead of hours.
        </p>

        <div className="rounded-lg border border-navy-border bg-navy-panel p-5">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Get in touch</p>
          <p className="mt-1 text-ink-secondary">
            Questions, feedback, or partnership ideas — we&apos;d love to hear from
            you at{" "}
            <a href="mailto:hello@nextreport.in" className="text-accent hover:underline">
              hello@nextreport.in
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
