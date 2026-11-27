import type { ReportReminder } from "@/generated/prisma/client";
import { reminderStatus } from "./model";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function buildReminderEmail(
  client: { id: string; accountName: string },
  reminder: ReportReminder,
  to: string,
  now = new Date(),
) {
  const status = reminderStatus(reminder, now);
  const when = reminder.nextDueAt.toLocaleString("en-US", {
    timeZone: reminder.timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const url = `https://nextreport.in/clients/${encodeURIComponent(client.id)}/reminders`;
  const generate = `https://nextreport.in/clients/${encodeURIComponent(client.id)}/reports/new`;
  const text = `${client.accountName}: ${status.label}.\nDue: ${when} (${reminder.timezone}).\nGenerate a report: ${generate}\nAlready sent it outside NextReport? Mark it as sent: ${url}\nThese reminders are for you; no report is sent to your client automatically. Manage or pause this reminder: ${url}`;
  return {
    to: [to],
    subject: `Report reminder — ${client.accountName}: ${status.label}`,
    text,
    html: `<!doctype html><html><body style="margin:0;background:#f3f5f8;font-family:Arial,sans-serif;color:#172033"><div style="max-width:600px;margin:24px auto;background:white;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden"><div style="padding:24px;background:#172033;color:white;font-size:24px;font-weight:bold"><img src="https://nextreport.in/logo.png" width="36" height="36" alt="N" style="vertical-align:middle;margin-right:10px">NextReport</div><div style="padding:24px"><p style="color:#805017;font-size:12px;font-weight:bold">REPORT REMINDER</p><h1 style="font-size:24px">${escape(status.label)}</h1><h2 style="font-size:20px">${escape(client.accountName)}</h2><p>Due ${escape(when)} (${escape(reminder.timezone)}).</p><p><a href="${generate}" style="display:inline-block;background:#f5b45a;color:#102033;padding:14px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Generate report →</a></p><p>Already sent it elsewhere? <a href="${url}">Mark as sent</a>.</p><p style="font-size:12px;color:#64748b">This reminds you to send a report. It does not send anything to your client automatically. <a href="${url}">Manage or pause reminders</a>.</p></div></div></body></html>`,
  };
}
