import { formatWhatsAppForNotification } from "@/lib/whatsapp-number";

/** WhatsApp lines for team notification emails (contact, demo, enquiry). */
export function whatsappNotifyLines(whatsapp: string): { textLines: string[]; htmlItems: string } {
  const { display, chatUrl } = formatWhatsAppForNotification(whatsapp);
  return {
    textLines: [`WhatsApp: ${display}`, `Chat: ${chatUrl}`],
    htmlItems: `<li><strong>WhatsApp:</strong> ${display}</li>
<li><strong>Chat on WhatsApp:</strong> <a href="${chatUrl}">${chatUrl}</a></li>`,
  };
}
