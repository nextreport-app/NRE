/**
 * Optional post-generation notifications — Slack incoming webhooks and
 * generic HTTPS webhooks (Zapier, Make, custom automation).
 */

export interface ReportNotificationPayload {
  event: "report.generated";
  reportId: string;
  clientName: string;
  platform: "META" | "GOOGLE";
  reportType: string;
  displayName: string | null;
  shareUrl: string | null;
  healthScore: number | null;
  healthBadge: string | null;
  generatedAt: string;
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidSlackWebhookUrl(url: string): boolean {
  if (!isHttpsUrl(url)) return false;
  return url.startsWith("https://hooks.slack.com/");
}

export function isValidAutomationWebhookUrl(url: string): boolean {
  return isHttpsUrl(url);
}

function buildSlackBlocks(payload: ReportNotificationPayload) {
  const lines = [
    `*Client:* ${payload.clientName}`,
    `*Platform:* ${payload.platform === "GOOGLE" ? "Google Ads" : "Meta Ads"}`,
    `*Report:* ${payload.displayName ?? payload.reportType}`,
  ];
  if (payload.healthBadge) lines.push(`*Health:* ${payload.healthBadge}`);
  if (payload.shareUrl) lines.push(`*Share link:* ${payload.shareUrl}`);

  return {
    text: `NextReport: ${payload.displayName ?? "Report"} ready for ${payload.clientName}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Report ready* — ${payload.clientName}` },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: lines.join("\n") },
      },
    ],
  };
}

async function postJson(url: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (err) {
    console.error("[report-notifications] webhook POST failed:", err);
    return false;
  }
}

/** Fire-and-forget — never throws; failures are logged only. */
export async function notifyReportGenerated(
  integrations: { slackWebhookUrl: string | null; automationWebhookUrl: string | null },
  payload: ReportNotificationPayload,
): Promise<void> {
  const tasks: Promise<boolean>[] = [];

  if (integrations.slackWebhookUrl && isValidSlackWebhookUrl(integrations.slackWebhookUrl)) {
    tasks.push(postJson(integrations.slackWebhookUrl, buildSlackBlocks(payload)));
  }

  if (integrations.automationWebhookUrl && isValidAutomationWebhookUrl(integrations.automationWebhookUrl)) {
    tasks.push(postJson(integrations.automationWebhookUrl, payload));
  }

  if (tasks.length === 0) return;

  const results = await Promise.all(tasks);
  if (results.some((ok) => !ok)) {
    console.warn("[report-notifications] one or more webhooks returned non-OK status for report", payload.reportId);
  }
}

export function buildShareUrl(shareToken: string | null | undefined, baseUrl?: string): string | null {
  if (!shareToken) return null;
  const origin = (baseUrl ?? process.env.NEXTAUTH_URL ?? "https://nextreport.in").replace(/\/$/, "");
  return `${origin}/r/${shareToken}`;
}

/** Loads user webhooks and sends notifications — safe to call without awaiting in hot path. */
export async function notifyReportGeneratedForUser(params: {
  userId: string;
  reportId: string;
  shareToken: string | null;
  clientName: string;
  platform: "META" | "GOOGLE";
  reportType: string;
  displayName: string | null;
  healthScore?: number | null;
  healthBadge?: string | null;
  integrationSelect: {
    slackWebhookUrl: string | null;
    automationWebhookUrl: string | null;
  } | null;
}): Promise<void> {
  if (!params.integrationSelect) return;
  const { slackWebhookUrl, automationWebhookUrl } = params.integrationSelect;
  if (!slackWebhookUrl && !automationWebhookUrl) return;

  await notifyReportGenerated(
    { slackWebhookUrl, automationWebhookUrl },
    {
      event: "report.generated",
      reportId: params.reportId,
      clientName: params.clientName,
      platform: params.platform,
      reportType: params.reportType,
      displayName: params.displayName,
      shareUrl: buildShareUrl(params.shareToken),
      healthScore: params.healthScore ?? null,
      healthBadge: params.healthBadge ?? null,
      generatedAt: new Date().toISOString(),
    },
  );
}
