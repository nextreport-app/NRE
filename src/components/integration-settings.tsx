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
        Optional: send a report summary to Slack or start an automation in Zapier or Make when a report is generated. Leave a field blank to turn that notification off.
      </p>

      <div>
        <label htmlFor="slack-webhook-url" className="mb-1 block text-sm text-dash-ink-secondary">Slack incoming webhook URL</label>
        <input
          id="slack-webhook-url"
          type="url"
          aria-describedby="slack-webhook-help"
          value={slackWebhookUrl}
          onChange={(e) => setSlackWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/..."
          className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
        />
        <details id="slack-webhook-help" className="mt-2 text-[13px] leading-relaxed text-dash-ink-secondary">
          <summary className="cursor-pointer font-medium text-dash-ink">How to get a Slack webhook</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Create an app for your workspace at <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-dash-accent hover:underline">Slack Apps ↗</a>, or ask your workspace admin to help.</li>
            <li>Open <strong>Incoming Webhooks</strong>, enable it, then select <strong>Add New Webhook to Workspace</strong>. Choose the channel and allow access.</li>
            <li>Copy the webhook URL, paste it above, and click <strong>Save integrations</strong>. Future report summaries will appear in that channel.</li>
          </ol>
          <a href="https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-dash-accent hover:underline">Slack setup guide ↗</a>
        </details>
      </div>

      <div>
        <label htmlFor="automation-webhook-url" className="mb-1 block text-sm text-dash-ink-secondary">Automation webhook URL (Zapier / Make)</label>
        <input
          id="automation-webhook-url"
          type="url"
          aria-describedby="automation-webhook-help"
          value={automationWebhookUrl}
          onChange={(e) => setAutomationWebhookUrl(e.target.value)}
          placeholder="https://hooks.zapier.com/hooks/catch/..."
          className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
        />
        <details id="automation-webhook-help" className="mt-2 text-[13px] leading-relaxed text-dash-ink-secondary">
          <summary className="cursor-pointer font-medium text-dash-ink">How to set up Zapier or Make</summary>
          <p className="mt-2 font-semibold text-dash-ink">Zapier</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>Create a Zap. Choose <strong>Webhooks by Zapier</strong> as the trigger app and <strong>Catch Hook</strong> as the event.</li>
            <li>Copy the webhook URL, paste it above, and click <strong>Save integrations</strong>.</li>
            <li>Generate a report in NextReport, then test the trigger in Zapier. Add your action and turn on the Zap.</li>
          </ol>
          <p className="mt-3 font-semibold text-dash-ink">Make</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>Create a scenario. Add <strong>Webhooks → Custom webhook</strong>, create a webhook, and copy its URL.</li>
            <li>Paste it above and click <strong>Save integrations</strong>. In Make, select <strong>Run once</strong>, then generate a report in NextReport to capture a sample.</li>
            <li>Add the next action, save the scenario, and activate it.</li>
          </ol>
          <p className="mt-2">The event includes the client name and report link. Webhook availability may depend on your Zapier or Make plan.</p>
          <a href="https://help.zapier.com/hc/en-us/articles/8496288690317-Trigger-Zaps-from-webhooks" target="_blank" rel="noopener noreferrer" className="mt-2 mr-4 inline-block text-dash-accent hover:underline">Zapier webhook guide ↗</a>
          <a href="https://help.make.com/webhooks" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-dash-accent hover:underline">Make webhook guide ↗</a>
        </details>
      </div>

      {error && <p className="text-sm text-dash-error">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md nre-account-primary bg-dash-accent px-4 py-2 text-sm font-medium hover:bg-dash-accent-hover disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save integrations"}
      </button>
    </form>
  );
}
