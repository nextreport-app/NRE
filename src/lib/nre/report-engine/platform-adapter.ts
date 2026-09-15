/**
 * Per-platform hooks inside the unified buildReportData pipeline.
 * Meta and TikTok share the Meta adapter; Google uses campaign-type slots.
 */

import type { Platform } from "../google-columns";
import type { NreRow } from "../columns";
import type { AggRow } from "../aggregate";
import { buildGoogleCampaignTypeMap, detectGoogleObjectiveKey, type GoogleObjectiveKey } from "../detect-objective";
import {
  googleSlideObjectiveLabels,
  googleCampaignResultDisplay,
  usesGoogleSlotEngine,
  usesMetaObjectiveEngine,
} from "../platform-reporting";
import {
  getGroupedResultDisplayForObjective,
  getSingleRowResultDisplayForObjective,
  normalizeCampaignName,
} from "../objective";
import { parseCellNum } from "../format";
import type { CampaignObjectiveRef } from "../slot-assignment";

export interface GoogleCampaignContext {
  fileObjectiveKey: GoogleObjectiveKey;
  campaignTypeMap: Map<string, GoogleObjectiveKey>;
}

export interface CampaignResultDisplay {
  resultLabel: string;
  costLabel: string;
  resultValue: string;
  cprValue: string;
}

export interface PlatformReportAdapter {
  readonly platform: Platform;
  readonly usesGoogleSlots: boolean;
  readonly usesMetaObjectives: boolean;

  resolveGoogleContext(
    primaryRawRows: NreRow[],
    campaignRawGroups: Record<string, NreRow[]>,
  ): GoogleCampaignContext | null;

  googleKeyForCampaign(campaignName: string, googleContext: GoogleCampaignContext | null): GoogleObjectiveKey | undefined;

  slideObjective(
    campaignName: string,
    googleContext: GoogleCampaignContext | null,
    campaignObjectiveMap: Map<string, CampaignObjectiveRef>,
  ): CampaignObjectiveRef;

  groupedResultDisplay(
    rows: AggRow[],
    rawRows: NreRow[],
    campaignName: string,
    googleContext: GoogleCampaignContext | null,
    campaignObjectiveMap: Map<string, CampaignObjectiveRef>,
    currencySymbol: string,
    totals: { spend: number; conversions: number },
  ): CampaignResultDisplay;

  singleRowResultDisplay(
    row: AggRow,
    rawRows: NreRow[],
    campaignName: string,
    googleContext: GoogleCampaignContext | null,
    campaignObjectiveMap: Map<string, CampaignObjectiveRef>,
    currencySymbol: string,
  ): CampaignResultDisplay;

  shouldEmitObjectiveWarnings(rows: AggRow[]): boolean;
}

const DEFAULT_OBJECTIVE: CampaignObjectiveRef = {
  resultLabel: "RESULTS",
  costLabel: "COST PER RESULT",
};

class MetaPlatformAdapter implements PlatformReportAdapter {
  readonly platform: Platform;
  readonly usesGoogleSlots = false;
  readonly usesMetaObjectives = true;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  resolveGoogleContext(): GoogleCampaignContext | null {
    return null;
  }

  googleKeyForCampaign(): GoogleObjectiveKey | undefined {
    return undefined;
  }

  slideObjective(
    campaignName: string,
    _googleContext: GoogleCampaignContext | null,
    campaignObjectiveMap: Map<string, CampaignObjectiveRef>,
  ): CampaignObjectiveRef {
    return campaignObjectiveMap.get(normalizeCampaignName(campaignName)) ?? DEFAULT_OBJECTIVE;
  }

  groupedResultDisplay(
    rows: AggRow[],
    _rawRows: NreRow[],
    campaignName: string,
    _googleContext: GoogleCampaignContext | null,
    campaignObjectiveMap: Map<string, CampaignObjectiveRef>,
    currencySymbol: string,
  ): CampaignResultDisplay {
    const objective = this.slideObjective(campaignName, null, campaignObjectiveMap);
    return getGroupedResultDisplayForObjective(rows, objective, currencySymbol);
  }

  singleRowResultDisplay(
    row: AggRow,
    _rawRows: NreRow[],
    campaignName: string,
    _googleContext: GoogleCampaignContext | null,
    campaignObjectiveMap: Map<string, CampaignObjectiveRef>,
    currencySymbol: string,
  ): CampaignResultDisplay {
    const objective = this.slideObjective(campaignName, null, campaignObjectiveMap);
    return getSingleRowResultDisplayForObjective(row, objective, currencySymbol);
  }

  shouldEmitObjectiveWarnings(rows: AggRow[]): boolean {
    return rows.some((r) => !r.objectiveConfident);
  }
}

class GooglePlatformAdapter implements PlatformReportAdapter {
  readonly platform = "GOOGLE" as const;
  readonly usesGoogleSlots = true;
  readonly usesMetaObjectives = false;

  resolveGoogleContext(
    primaryRawRows: NreRow[],
    campaignRawGroups: Record<string, NreRow[]>,
  ): GoogleCampaignContext {
    const headers = Object.keys(primaryRawRows[0]?._raw ?? {});
    const fileObjectiveKey = detectGoogleObjectiveKey(headers);
    return {
      fileObjectiveKey,
      campaignTypeMap: buildGoogleCampaignTypeMap(campaignRawGroups, headers),
    };
  }

  googleKeyForCampaign(campaignName: string, googleContext: GoogleCampaignContext | null): GoogleObjectiveKey {
    return googleContext?.campaignTypeMap.get(campaignName) ?? googleContext?.fileObjectiveKey ?? "search";
  }

  slideObjective(
    campaignName: string,
    googleContext: GoogleCampaignContext | null,
    _campaignObjectiveMap: Map<string, CampaignObjectiveRef>,
  ): CampaignObjectiveRef {
    const key = this.googleKeyForCampaign(campaignName, googleContext);
    return googleSlideObjectiveLabels(key);
  }

  groupedResultDisplay(
    _rows: AggRow[],
    rawRows: NreRow[],
    campaignName: string,
    googleContext: GoogleCampaignContext | null,
    _campaignObjectiveMap: Map<string, CampaignObjectiveRef>,
    currencySymbol: string,
    totals: { spend: number; conversions: number },
  ): CampaignResultDisplay {
    const key = this.googleKeyForCampaign(campaignName, googleContext);
    return googleCampaignResultDisplay(rawRows, key, currencySymbol, totals);
  }

  singleRowResultDisplay(
    row: AggRow,
    rawRows: NreRow[],
    campaignName: string,
    googleContext: GoogleCampaignContext | null,
    _campaignObjectiveMap: Map<string, CampaignObjectiveRef>,
    currencySymbol: string,
  ): CampaignResultDisplay {
    const key = this.googleKeyForCampaign(campaignName, googleContext);
    return googleCampaignResultDisplay(rawRows, key, currencySymbol, {
      spend: parseCellNum(row.spend),
      conversions: parseCellNum(row.results),
    });
  }

  shouldEmitObjectiveWarnings(): boolean {
    return false;
  }
}

export function createPlatformReportAdapter(platform: Platform): PlatformReportAdapter {
  if (usesGoogleSlotEngine(platform)) {
    return new GooglePlatformAdapter();
  }
  return new MetaPlatformAdapter(platform);
}

/** Re-export for callers that still branch on platform helpers directly. */
export { usesGoogleSlotEngine, usesMetaObjectiveEngine };
