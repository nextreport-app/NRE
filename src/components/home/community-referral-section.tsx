import Link from "next/link";
import { REFERRAL_PROGRAM_LINE, WHATSAPP_COMMUNITY_LINE } from "@/lib/product-positioning";
import { WhatsAppChatLink } from "@/components/whatsapp-chat-link";

export function CommunityReferralSection() {
  return (
    <section className="bg-navy px-6 py-14">
      <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-navy-border bg-navy-panel p-6 text-left">
          <h2 className="text-lg font-semibold text-white">Refer an agency</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{REFERRAL_PROGRAM_LINE}</p>
          <Link href="/refer" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
            How referrals work →
          </Link>
        </div>
        <div className="rounded-xl border border-navy-border bg-navy-panel p-6 text-left">
          <h2 className="text-lg font-semibold text-white">WhatsApp for agencies</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{WHATSAPP_COMMUNITY_LINE}</p>
          <WhatsAppChatLink
            className="mt-4 inline-block text-sm font-medium text-accent underline hover:no-underline"
            message="Hi — I'm an agency using (or trying) NextReport for Meta reporting."
          >
            Open WhatsApp →
          </WhatsAppChatLink>
        </div>
      </div>
    </section>
  );
}
