import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { pageMetadata } from "@/lib/seo";

export function helpDocMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return pageMetadata({
    title: input.title,
    description: input.description,
    path: input.path,
  });
}

export async function HelpDocShell({
  title,
  subtitle,
  children,
  footer = "download-only",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  /** Footer links under the article — metrics/objectives pages use `none`. */
  footer?: "none" | "download-only";
}) {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="flex-1">
        <section className="bg-navy px-6 py-14 text-center">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold text-white sm:text-4xl">{title}</h1>
            <p className="mt-3 text-lg text-ink-muted">{subtitle}</p>
          </div>
        </section>
        <div className="mx-auto max-w-3xl space-y-8 px-6 py-12 text-[15px] leading-relaxed text-ink-secondary">
          {children}
          {footer === "download-only" ? (
            <p className="border-t border-navy-border pt-8 text-sm text-ink-muted">
              <Link href="/help/download" className="text-accent-orange hover:underline">
                CSV export guide
              </Link>
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}
