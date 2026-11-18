import type { DateRangeIso } from "../date-range";
export type AudienceDimension = "age" | "location" | "platform" | "placement";
export type MetaSourceKind =
  AudienceDimension | "platform-placement" | "creative";
export interface MetaContentOptions {
  audience: AudienceDimension[];
  locationLevel?: "region" | "country";
  creatives: boolean;
  includeStandard: boolean;
  ranking: "cpr" | "roas" | "ctr" | "spend";
  minSpend: number;
  minResults: number;
  selectedAdIds?: string[];
}
export interface MetaObservation {
  date: string;
  campaign: string;
  campaignId?: string;
  adSet?: string;
  adSetId?: string;
  adId?: string;
  adName?: string;
  resultAction?: string;
  resultType: string;
  resultLabel: string;
  costLabel: string;
  spend: number;
  impressions: number;
  results: number | null;
  clicks: number | null;
  linkClicks: number | null;
  landingViews: number | null;
  purchaseValue: number | null;
  age?: string;
  location?: string;
  platform?: string;
  placement?: string;
  attribution?: string;
}
export interface MetaContentSource {
  kind: MetaSourceKind;
  source: "csv" | "api";
  currency: string;
  coverage: DateRangeIso;
  rows: MetaObservation[];
}
export interface CreativeMediaSnapshot {
  data: string;
  width: number;
  height: number;
  label: string;
}
export interface MetaReportContent {
  version: 1;
  sourceOnly?: boolean;
  options: MetaContentOptions;
  sources: MetaContentSource[];
  media: Record<string, CreativeMediaSnapshot>;
  notices: string[];
  campaigns?: string[];
}
export interface MetaPerformanceRow {
  key: string;
  name: string;
  adId?: string;
  campaign?: string;
  spend: number;
  impressions: number;
  results: number | null;
  ctr: number | null;
  cpr: number | null;
  cpc: number | null;
  cpm: number | null;
  roas: number | null;
  websiteCvr: number | null;
  eligible: boolean;
  rank?: number;
}
export interface MetaContentPage {
  id: string;
  kind: "audience" | "creative-table" | "creative-preview";
  title: string;
  dateLabel: string;
  objective: string;
  costLabel: string;
  rows: MetaPerformanceRow[];
  note: string;
  insight?: string;
  visible?: boolean;
}
export interface MetaContentPresentation {
  includeStandard: boolean;
  currencySymbol: string;
  pages: MetaContentPage[];
  notices: string[];
  media: Record<string, CreativeMediaSnapshot>;
}
export const DIMENSION_LABELS: Record<AudienceDimension, string> = {
  age: "Age",
  location: "Location",
  platform: "Platform",
  placement: "Placement",
};
