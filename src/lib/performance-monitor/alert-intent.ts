import { createHash } from "node:crypto";
import {
  actionableSignals,
  decisionAlertKey,
  evaluatePerformanceFacts,
} from "./decision";
import type { PerformanceSnapshot } from "./facts";

/** Shared by detection and delivery validation, including retries. */
export function performanceAlertIntent(
  id: string,
  snapshot: PerformanceSnapshot,
  includeReviews: boolean,
) {
  const facts = snapshot.facts;
  if (!facts || snapshot.error) return null;
  const alerts = evaluatePerformanceFacts(facts).campaigns.flatMap((campaign) =>
    actionableSignals(campaign)
      .filter(
        (signal) =>
          signal.tone === "critical" ||
          (includeReviews && signal.state !== "continuing"),
      )
      .map((signal) => ({ campaign, signal })),
  );
  if (!alerts.length) return null;
  const critical = alerts.some((a) => a.signal.tone === "critical");
  const selected = critical
    ? alerts.filter((a) => a.signal.tone === "critical")
    : alerts;
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        Object.entries(snapshot.config)
          .filter(([, value]) => value !== undefined)
          .sort(([a], [b]) => a.localeCompare(b)),
        selected
          .map((a) => [a.campaign.id ?? a.campaign.name, a.signal.key])
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ]),
    )
    .digest("hex")
    .slice(0, 20);
  return {
    alerts: selected,
    critical,
    key: `${decisionAlertKey(id, facts.periodA.endIso, facts.periodA.startIso, critical ? "critical" : "review")}:${fingerprint}`,
  };
}
