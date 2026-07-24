import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — NextReport",
};

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link href="/" className="text-sm text-indigo-400 hover:underline">
        ← Back to NextReport
      </Link>

      <h1 className="mt-6 text-3xl font-semibold text-white">Contact</h1>

      <div className="mt-8 space-y-4 text-sm leading-relaxed text-slate-300">
        <p>
          Have a question, feedback, or need help with your NextReport account?
          We&apos;d like to hear from you.
        </p>

        <div className="rounded-lg border border-slate-800 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
          <a
            href="mailto:hello@nextreport.in"
            className="mt-1 block text-lg font-medium text-indigo-400 hover:underline"
          >
            hello@nextreport.in
          </a>
        </div>

        <p className="text-slate-400">We aim to respond within one business day.</p>
      </div>
    </main>
  );
}
