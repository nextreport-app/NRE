import { formatWhatsAppForNotification } from "@/lib/whatsapp-number";

/** WhatsApp lines for team notification emails (contact, demo, enquiry). */
export function whatsappNotifyLines(
  whatsapp: string | null | undefined,
): { textLines: string[]; htmlItems: string } {
  const trimmed = whatsapp?.trim() ?? "";
  if (!trimmed) {
    return { textLines: [], htmlItems: "" };
  }
  const { display, chatUrl } = formatWhatsAppForNotification(trimmed);
  return {
    textLines: [`WhatsApp: ${display}`, `Chat: ${chatUrl}`],
    htmlItems: `<li><strong>WhatsApp:</strong> ${display}</li>
<li><strong>Chat on WhatsApp:</strong> <a href="${chatUrl}">${chatUrl}</a></li>`,
  };
}
