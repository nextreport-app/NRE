import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { ContactForm } from "@/components/contact-form";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Product Feedback",
  description:
    "Share feedback on NextReport — ideas, praise, or what we should improve. We read every message.",
  path: "/feedback",
});

export default async function FeedbackPage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="mx-auto w-full max-w-[600px] flex-1 px-6 py-16 pb-24 sm:pb-16">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-white">Product feedback</h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
            Tell us what is working, what is confusing, or what you wish NextReport did. No sales pitch — this goes
            straight to the product team.
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            Need account or billing help?{" "}
            <Link href="/contact" className="text-[#f5b45a] hover:underline">
              Contact &amp; support
            </Link>{" "}
            or{" "}
            <Link href="/support" className="text-[#f5b45a] hover:underline">
              open a support ticket
            </Link>
            .
          </p>
        </div>

        <div className="mt-10">
          <ContactForm
            defaultSubject="Product Feedback"
            messagePlaceholder="Share your feedback on the wizard, reports, or anything else about NextReport..."
          />
        </div>
      </main>
    </>
  );
}
