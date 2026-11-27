import type {
  CampaignPerformance,
  PerformanceSignal,
  PerformanceSnapshot,
} from "./facts";
import { formatMetaPeriod } from "./format-period";
import { signalObservation, type Observation } from "./portfolio";
import { signalSummaryLine } from "./summary-line";

type Alert = { campaign: CampaignPerformance; signal: PerformanceSignal };
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
function value(n: number | null, unit: Observation["unit"], currency: string) {
  if (n == null || !Number.isFinite(n)) return "Unavailable";
  if (unit === "money")
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(n);
  return `${n.toLocaleString("en-US", { maximumFractionDigits: unit === "number" ? 0 : 2 })}${unit === "percent" ? "%" : unit === "multiple" ? "×" : ""}`;
}
/** Inline styles and presentation tables work in Gmail, Outlook, and mobile mail. */
export function buildPerformanceAlertEmail(input: {
  accountName: string;
  clientId: string;
  snapshot: PerformanceSnapshot;
  alerts: Alert[];
}) {
  const { accountName, clientId, snapshot, alerts } = input;
  const facts = snapshot.facts!;
  const critical = alerts.some((a) => a.signal.tone === "critical");
  const accent = critical ? "#b42318" : "#92400e";
  const tint = critical ? "#fff1f0" : "#fffbeb";
  const title = critical
    ? "Your campaigns need urgent review"
    : "Changes worth reviewing";
  const current = formatMetaPeriod(
    facts.periodA.startIso,
    facts.periodA.endIso,
  );
  const previous = formatMetaPeriod(
    facts.periodB.startIso,
    facts.periodB.endIso,
  );
  const checked = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: snapshot.config.timezone,
  }).format(new Date(snapshot.checkedAt));
  const url = `https://nextreport.in/performance/meta-ads?client=${encodeURIComponent(clientId)}`;
  const shown = [...alerts]
    .sort(
      (a, b) =>
        Number(b.signal.tone === "critical") -
        Number(a.signal.tone === "critical"),
    )
    .slice(0, 10);
  const more =
    alerts.length > shown.length
      ? `${alerts.length - shown.length} more ${alerts.length - shown.length === 1 ? "alert is" : "alerts are"} available in your dashboard.`
      : "";
  const cards = shown.map(({ campaign, signal }) => {
    const observation = signalObservation(campaign, signal);
    const color = signal.tone === "critical" ? "#b42318" : "#92400e";
    const label = signal.tone === "critical" ? "Critical" : "Needs review";
    const metric = /^(cpr-|cost-above-target)/.test(signal.key)
      ? campaign.costLabel
      : /^results-/.test(signal.key)
        ? campaign.objective
        : signal.metric;
    const change =
      signal.change == null || !Number.isFinite(signal.change)
        ? "—"
        : `${signal.change > 0 ? "+" : signal.change < 0 ? "−" : ""}${Math.abs(signal.change).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
    const description = signalSummaryLine(campaign, signal);
    const figures = observation
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #e2e8f0;table-layout:fixed"><tr>${[
          [
            signal.key === "results-stopped-7d" ? "Last 7 completed days" : "Selected period",
            value(
              observation.current,
              observation.unit,
              snapshot.config.currency,
            ),
          ],
          [
            observation.reference === "target"
              ? "Saved target"
              : signal.key === "results-stopped-7d" ? "Previous 7 days" : "Previous period",
            value(
              observation.previous,
              observation.unit,
              snapshot.config.currency,
            ),
          ],
          [observation.reference === "target" ? "Vs target" : "Change", change],
        ]
          .map(
            ([name, v], i) =>
              `<td width="33%" valign="top" style="padding:12px 6px 0 0;word-wrap:break-word"><div style="font-size:12px;line-height:18px;color:#64748b">${name}</div><div style="margin-top:4px;font-size:18px;line-height:25px;font-weight:700;color:${i === 2 && signal.change != null && Number.isFinite(signal.change) && signal.change !== 0 ? color : "#172033"}">${escape(v)}</div></td>`,
          )
          .join("")}</tr></table>`
      : "";
    return {
      text: `${label} · ${campaign.name} [Campaign]\n${description}${observation ? `\n${metric}: ${value(observation.current, observation.unit, snapshot.config.currency)} · ${observation.reference === "target" ? "Target" : "Previous"}: ${value(observation.previous, observation.unit, snapshot.config.currency)} · Change: ${change}` : ""}`,
      html: `<tr><td style="padding:0 24px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-left:4px solid ${color};border-radius:12px;background:#ffffff"><tr><td style="padding:20px"><div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${color}">${label}</div><h2 style="margin:10px 0 4px;font-size:18px;line-height:26px;color:#172033;word-break:break-word">${escape(campaign.name)} <span style="font-size:12px;font-weight:400;color:#64748b">[Campaign]</span></h2><div style="font-size:12px;line-height:18px;color:#64748b">${escape(metric)}</div><p style="margin:12px 0 0;font-size:15px;line-height:24px;color:#334155">${escape(description)}</p>${figures}</td></tr></table></td></tr>`,
    };
  });
  const text = `NextReport · Meta Ads ${critical ? "critical alert" : "performance review"}\n${accountName}\n${title}\n\nSelected period: ${current}\nPrevious period: ${previous}\nAccount timezone: ${snapshot.config.timezone}\n\n${cards.map((c) => c.text).join("\n\n")}\n${more}\nReview performance: ${url}\n\nLast checked: ${checked} (${snapshot.config.timezone}).\nMeta conversions can arrive later. Review these changes before deciding what to adjust.\nYou received this email because critical monitoring alerts are automatic; review warnings follow your saved email preference. Manage them in the dashboard.`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head><body style="margin:0;padding:0;background:#f3f5f8;color:#172033;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escape(accountName)} · ${alerts.length} ${alerts.length === 1 ? "change needs" : "changes need"} review. ${escape(current)} compared with ${escape(previous)}.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8"><tr><td align="center" style="padding:24px 8px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px"><tr><td style="padding:24px;background:#172033;border-radius:16px 16px 0 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="48" valign="middle"><img src="https://nextreport.in/logo.png" width="48" height="48" alt="N" style="display:block;width:48px;height:48px;border:0;outline:none;text-decoration:none;color:#ffffff;font-size:26px;font-weight:700"></td><td valign="middle" style="padding-left:12px;font-size:24px;line-height:30px;font-weight:700;letter-spacing:-.5px;color:#ffffff">NextReport</td></tr></table><div style="margin-top:8px;font-size:12px;color:#cbd5e1;letter-spacing:1px;text-transform:uppercase">Meta Ads · Performance alert</div></td></tr><tr><td style="padding:24px"><span style="display:inline-block;padding:6px 10px;background:${tint};color:${accent};border-radius:6px;font-size:12px;font-weight:700">${critical ? "CRITICAL ALERT" : "REVIEW NEEDED"}</span><h1 style="margin:16px 0 8px;font-size:26px;line-height:34px;letter-spacing:-.5px;color:#172033">${title}</h1><p style="margin:0;font-size:17px;line-height:26px;font-weight:700;word-break:break-word">${escape(accountName)}</p><p style="margin:8px 0 0;font-size:14px;line-height:22px;color:#64748b">${alerts.length} ${alerts.length === 1 ? "new alert" : "new alerts"} in this comparison.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:#f8fafc;border-radius:8px"><tr><td style="padding:14px;font-size:13px;line-height:23px;color:#475569">Selected period<br><strong style="font-size:15px;color:#172033">${escape(current)}</strong><br><span style="display:block;margin-top:6px">Compared with <strong>${escape(previous)}</strong></span><span style="display:block;font-size:12px;color:#64748b">Account timezone: ${escape(snapshot.config.timezone)}</span></td></tr></table></td></tr>${cards.map((c) => c.html).join("")}<tr><td style="padding:8px 24px 28px">${more ? `<p style="font-size:14px;line-height:22px;color:#64748b">${escape(more)}</p>` : ""}<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#f7b955" style="border-radius:8px;mso-padding-alt:14px 24px"><a href="${escape(url)}" style="display:inline-block;padding:14px 24px;color:#172033;text-decoration:none;font-size:15px;font-weight:700;border-radius:8px">Review performance &rarr;</a></td></tr></table><p style="margin:16px 0 0;font-size:12px;line-height:20px;color:#64748b">Last checked: ${escape(checked)} (${escape(snapshot.config.timezone)}).<br>Meta conversions can arrive later. Review these changes before deciding what to adjust.</p></td></tr><tr><td style="padding:20px 24px;border-top:1px solid #e2e8f0;font-size:12px;line-height:20px;color:#64748b">You received this email because critical monitoring alerts are automatic; review warnings follow your saved email preference. <a href="${escape(url)}" style="color:#475569;text-decoration:underline">Manage alert preferences</a> in your dashboard.</td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}
