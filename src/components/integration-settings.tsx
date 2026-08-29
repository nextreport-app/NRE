"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

export function IntegrationSettings({
  initialSlackWebhookUrl,
  initialAutomationWebhookUrl,
}: {
  initialSlackWebhookUrl: string | null;
  initialAutomationWebhookUrl: string | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(initialSlackWebhookUrl ?? "");
  const [automationWebhookUrl, setAutomationWebhookUrl] = useState(initialAutomationWebhookUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/account/integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slackWebhookUrl: slackWebhookUrl.trim() || null,
        automationWebhookUrl: automationWebhookUrl.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      const message = data.error || "Something went wrong.";
      setError(message);
      showToast(message, "error");
      return;
    }

    showToast("Integration settings saved.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-dash-border bg-dash-card p-5">
      <p className="text-[13px] text-dash-ink-secondary">
        When a report finishes generating, NextReport can post a summary to Slack or send a JSON payload to a webhook
        (Zapier, Make, or your own automation).
      </p>

      <div>
        <label className="mb-1 block text-sm text-dash-ink-secondary">Slack incoming webhook URL</label>
        <input
          value={slackWebhookUrl}
          onChange={(e) => setSlackWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/..."
          className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
        />
        <p className="mt-1 text-[12px] text-dash-ink-secondary">
          Create one in Slack → Apps → Incoming Webhooks. Leave blank to disable.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm text-dash-ink-secondary">Automation webhook URL (Zapier / Make)</label>
        <input
          value={automationWebhookUrl}
          onChange={(e) => setAutomationWebhookUrl(e.target.value)}
          placeholder="https://hooks.zapier.com/hooks/catch/..."
          className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
        />
        <p className="mt-1 text-[12px] text-dash-ink-secondary">
          Receives JSON with event <code className="text-dash-ink">report.generated</code>, client name, platform, and
          share link.
        </p>
      </div>

      {error && <p className="text-sm text-dash-error">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save integrations"}
      </button>
    </form>
  );
}
