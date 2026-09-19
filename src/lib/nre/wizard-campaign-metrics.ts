/**
 * Per-campaign metric pool + default selection — shared by the /metrics API
 * route and the upload wizard when the user changes an objective dropdown.
 */

import type { Platform } from "./google-columns";
import {
  filterAddableMetrics,
  listSelectableMetrics,
  type AvailableMetric,
  type SelectedMetric,
} from "./available-metrics";
import {
  defaultMetricSelectionForCampaign,
  googleObjectiveKeyFromHeaders,
  metricsDictionaryPlatform,
  usesMetaObjectiveEngine,
} from "./platform-reporting";
import { objectiveKeyFor, stripNeverKeys } from "./slot-assignment";
import type { GoogleObjectiveKey } from "./detect-objective";

export interface CampaignMetricBundle {
  selection: SelectedMetric[];
  available: SelectedMetric[];
}

export function buildCampaignMetricBundle(
  platform: Platform,
  headers: string[],
  resultLabel: string,
  costLabel: string,
  googleObjectiveKey?: GoogleObjectiveKey,
): CampaignMetricBundle {
  const metricsPlatform = metricsDictionaryPlatform(platform);
  const googleKey = platform === "GOOGLE" ? (googleObjectiveKey ?? googleObjectiveKeyFromHeaders(headers)) : undefined;
  const fullPool = listSelectableMetrics(headers, metricsPlatform);
  const objectiveKey = usesMetaObjectiveEngine(platform) ? objectiveKeyFor(resultLabel) : undefined;

  const selection = defaultMetricSelectionForCampaign(platform, {
    resultLabel,
    costLabel,
    headers,
    googleObjectiveKey: googleKey,
  }).filter((m): m is SelectedMetric => m !== null);

  const strippedSelection = objectiveKey
    ? stripNeverKeys(selection, objectiveKey).filter((m): m is SelectedMetric => m !== null)
    : selection;

  const available = filterAddableMetrics(
    (objectiveKey ? stripNeverKeys(fullPool, objectiveKey) : fullPool).filter(
      (m): m is AvailableMetric => m !== null,
    ),
    strippedSelection,
  );

  return { selection: strippedSelection, available };
}
