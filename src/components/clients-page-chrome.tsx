"use client";

import Link from "next/link";
import { SupportTicketLink } from "@/components/support-ticket-link";
import { WhatsAppChatLink } from "@/components/whatsapp-chat-link";
import { useSiteCopy } from "@/hooks/use-site-copy";

export function ClientsPageHeader({ isEmpty, clientCount, scheduling = false }: { isEmpty: boolean; clientCount: number; scheduling?: boolean }) {
  const { dashboard: d } = useSiteCopy();

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-dash-ink">{scheduling ? "Schedule reports" : d.clientsTitle}</h1>
        <p className="mt-1 text-[15px] text-dash-ink-secondary">
          {scheduling ? "Choose a client to set up or manage recurring Meta drafts." : isEmpty ? d.clientsEmptySubtitle : d.clientsCountSubtitle(clientCount)}
        </p>
      </div>
      {!isEmpty ? (
        <Link
          href="/clients/new"
          className="inline-flex items-center justify-center rounded-lg bg-dash-accent px-5 py-2.5 text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
        >
          {d.clientsNewClient}
        </Link>
      ) : null}
    </div>
  );
}

export function ClientsPageSupportLine() {
  const { dashboard: d } = useSiteCopy();
  return (
    <aside aria-label="Client help" className="mt-8 rounded-lg border border-dash-border bg-dash-bg/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-dash-ink">{d.clientsSupportPrefix}</h2>
        <div className="flex flex-wrap gap-2">
          <SupportTicketLink openInNewTab appearance="button" className="min-h-11 cursor-pointer">Support ticket</SupportTicketLink>
          <WhatsAppChatLink message="Hi — I need help with NextReport." className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-dash-border px-3 py-2 text-sm font-medium text-dash-ink hover:bg-dash-card focus-visible:outline-2 focus-visible:outline-dash-accent">WhatsApp chat</WhatsAppChatLink>
        </div>
      </div>
    </aside>
  );
}
