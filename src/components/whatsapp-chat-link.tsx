import { WHATSAPP_URL } from "@/lib/site-links";

/** Opens WhatsApp with an optional pre-filled message — instant chat, not the contact form. */
export function buildWhatsAppSupportUrl(message?: string): string {
  if (!message?.trim()) return WHATSAPP_URL;
  const separator = WHATSAPP_URL.includes("?") ? "&" : "?";
  return `${WHATSAPP_URL}${separator}text=${encodeURIComponent(message.trim())}`;
}

export function WhatsAppChatLink({
  children = "chat with us on WhatsApp",
  className = "font-medium text-dash-accent underline hover:no-underline",
  message,
}: {
  children?: React.ReactNode;
  className?: string;
  /** Pre-filled chat opener — helps you see context when they message. */
  message?: string;
}) {
  return (
    <a
      href={buildWhatsAppSupportUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
