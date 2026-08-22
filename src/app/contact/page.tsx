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
      <main className="mx-auto w-full max-w-[600px] flex-1 px-6 py-16 pb-24 sm:pb-16">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-white">Get in Touch</h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
            Have a question, feedback, or need help with your NextReport account? We will respond
            within one business day.
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            Or email us directly:{" "}
            <a href="mailto:hello@nextreport.in" className="text-[#f5b45a] hover:underline">
              hello@nextreport.in
            </a>
          </p>
        </div>

        <p className="mt-10 text-center text-sm text-ink-muted">
          We reply on WhatsApp within a few hours. Email replies within one business day.
        </p>

        <div className="mt-6">
          <ContactForm />
        </div>
      </main>
    </>
  );
}
