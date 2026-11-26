import type { OverviewRow } from "@/lib/agency-overview";

export async function loadMetaOverview(): Promise<OverviewRow[]> {
  const response = await fetch("/api/agency-overview", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw Error(data.error ?? "Overview could not load.");
  return data.clients;
}

/** Reset only the opened account; later refreshes preserve in-visit choices. */
export async function openMetaDashboard(
  clientId: string,
): Promise<OverviewRow[]> {
  const clients = await loadMetaOverview();
  const client = clients.find((c) => c.id === clientId);
  if (
    !client ||
    (client.comparison.days === 30 &&
      !client.comparison.customStart &&
      !client.comparison.customEnd)
  )
    return clients;
  const response = await fetch(
    `/api/clients/${encodeURIComponent(clientId)}/performance-monitor`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "comparison", days: 30 }),
    },
  );
  if (!response.ok) {
    const data = await response.json();
    throw Error(
      data.error ?? "Could not open the last 30 days. Reload to retry.",
    );
  }
  // The comparison endpoint invalidates the old snapshot. Never relabel 7-day data.
  return loadMetaOverview();
}
