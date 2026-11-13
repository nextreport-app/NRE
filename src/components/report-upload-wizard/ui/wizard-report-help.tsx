import { SupportTicketLink } from "@/components/support-ticket-link";
import { WhatsAppChatLink } from "@/components/whatsapp-chat-link";
import { WizardFeedbackLink } from "./wizard-feedback-link";

export function WizardReportHelp({ clientId }: { clientId: string }) {
  return <aside aria-label="Report help" className="mt-8 rounded-lg border border-dash-border bg-dash-bg/30 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-dash-ink">Need help with this report?</h3>
      <div className="flex flex-wrap gap-2">
        <SupportTicketLink clientId={clientId} openInNewTab appearance="button">Support ticket</SupportTicketLink>
        <WhatsAppChatLink message="Hi — I need help with a report in NextReport." className="inline-flex min-h-10 items-center justify-center rounded-lg border border-dash-border px-3 py-2 text-sm font-medium text-dash-ink hover:bg-dash-card focus-visible:outline-2 focus-visible:outline-dash-accent">WhatsApp chat</WhatsAppChatLink>
      </div>
    </div>
    <div className="mt-3 border-t border-dash-border pt-3"><WizardFeedbackLink /></div>
  </aside>;
}
