import Link from "next/link";

/** Compact CTA shown in the report wizard and dashboard when users may need help. */
export function SupportTicketLink({
  clientId,
  reportId,
  className = "",
}: {
  clientId?: string;
  reportId?: string;
  className?: string;
}) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", clientId);
  if (reportId) params.set("reportId", reportId);
  const href = params.toString() ? `/support?${params}` : "/support";

  return (
    <Link href={href} className={`font-medium text-dash-accent underline hover:no-underline ${className}`}>
      Raise a support ticket
    </Link>
  );
}
