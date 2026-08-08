import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contact — NextReport",
};

export default async function ContactPage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="mx-auto w-full max-w-[600px] flex-1 px-6 py-16">
        <Link href="/" className="text-sm text-accent hover:underline">
          ← Back to NextReport
        </Link>

        <div className="mt-6 text-center">
          <h1 className="text-3xl font-semibold text-white">Get in Touch</h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
            Have a question, feedback, or need help with your NextReport account? We will respond
            within one business day.
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            Or email us directly:{" "}
            <a href="mailto:hello@nextreport.in" className="text-accent hover:underline">
              hello@nextreport.in
            </a>
          </p>
        </div>

        <div className="mt-10">
          <ContactForm />
        </div>
      </main>
    </>
  );
}
