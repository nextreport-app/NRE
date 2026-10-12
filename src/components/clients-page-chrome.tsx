"use client";

import Link from "next/link";
import { SupportTicketLink } from "@/components/support-ticket-link";
import { WhatsAppChatLink } from "@/components/whatsapp-chat-link";
import { useSiteCopy } from "@/hooks/use-site-copy";

export function ClientsPageHeader({
  isEmpty,
  clientCount,
  showGettingStarted,
}: {
  isEmpty: boolean;
  clientCount: number;
  showGettingStarted: boolean;
}) {
  const { dashboard: d } = useSiteCopy();

  if (showGettingStarted && isEmpty) return null;

  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-dash-ink">{d.clientsTitle}</h1>
        <p className="mt-1 text-[15px] text-dash-ink-secondary">
          {isEmpty ? d.clientsEmptySubtitle : d.clientsCountSubtitle(clientCount)}
        </p>
      </div>
      {!isEmpty ? (
        <Link
          href="/clients/new"
          className="rounded-lg bg-dash-accent px-5 py-2.5 text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
        >
          {d.clientsNewClient}
        </Link>
      ) : null}
    </div>
  );
}

export function ClientsGuidePlaceholder() {
  const { dashboard: d } = useSiteCopy();
  return (
    <div
      className="rounded-xl border border-dashed border-dash-border/90 bg-dash-bg/40 px-6 py-10 text-center"
      aria-hidden={false}
    >
      <p className="text-[14px] text-dash-ink-secondary">{d.clientsPlaceholderDuringGuide}</p>
    </div>
  );
}

export function ClientsPageSupportLine() {
  const { dashboard: d } = useSiteCopy();
  return (
    <p className="mt-10 text-center text-[13px] leading-relaxed text-dash-ink-secondary sm:text-left">
      {d.clientsSupportPrefix} <SupportTicketLink openInNewTab /> {d.clientsSupportOr}{" "}
      <WhatsAppChatLink message="Hi — I need help with NextReport." />
    </p>
  );
}
