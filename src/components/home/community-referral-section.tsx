"use client";

import Link from "next/link";
import { WhatsAppChatLink } from "@/components/whatsapp-chat-link";
import { useSiteCopy } from "@/hooks/use-site-copy";

export function CommunityReferralSection() {
  const { home } = useSiteCopy();

  return (
    <section className="bg-navy px-6 py-14">
      <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-navy-border bg-navy-panel p-6 text-left">
          <h2 className="text-lg font-semibold text-white">{home.referTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{home.referralLine}</p>
          <Link href="/refer" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
            {home.referLink}
          </Link>
        </div>
        <div className="rounded-xl border border-navy-border bg-navy-panel p-6 text-left">
          <h2 className="text-lg font-semibold text-white">{home.whatsappTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{home.whatsappLine}</p>
          <WhatsAppChatLink
            className="mt-4 inline-block text-sm font-medium text-accent underline hover:no-underline"
            message={home.whatsappPrefill}
          >
            {home.whatsappLink}
          </WhatsAppChatLink>
        </div>
      </div>
    </section>
  );
}
