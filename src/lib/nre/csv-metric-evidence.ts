import type { NreRow } from "./columns";
import { normalizeCampaignName } from "./objective";
import { CURRENCY_SYMBOLS } from "./format";
const CURRENCY_PREFIXES = [...new Set(Object.values(CURRENCY_SYMBOLS))].sort((a,b)=>b.length-a.length);
const CURRENCY_CODE_BOUNDARY = new RegExp(`^(?:${Object.keys(CURRENCY_SYMBOLS).join("|")})\\s*|\\s*(?:${Object.keys(CURRENCY_SYMBOLS).join("|")})$`,"gi");
export interface CsvMetricHeaderProfile { all: string[]; campaigns: Record<string,string[]> }
/** Blank / dash / N/A is unavailable. An explicitly exported zero is real data. */
export function hasNumericCsvValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  let text=value.trim();
  if (!text) return false;
  text=text.replace(CURRENCY_CODE_BOUNDARY,"").trim();
  for (const symbol of CURRENCY_PREFIXES) { if (text.startsWith(symbol)) text=text.slice(symbol.length); if (text.endsWith(symbol)) text=text.slice(0,-symbol.length); }
  text=text.replace(/[,\s\u00a0]/g,"");
  if (/^\(.*\)$/.test(text)) text=`-${text.slice(1,-1)}`;
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(text) && Number.isFinite(Number(text.replace(/%$/,"")));
}
export function numericMetricHeaders(headers: readonly string[], rows: readonly NreRow[]): string[] {
  const observed=new Set<string>();
  for (const row of rows) for (const [header,value] of Object.entries(row._raw ?? {})) { const key=header.trim().toLowerCase(); if (!observed.has(key) && hasNumericCsvValue(value)) observed.add(key); }
  return headers.filter(header=>observed.has(header.trim().toLowerCase()));
}
export function buildCsvMetricHeaderProfile(headers: string[], rows: NreRow[]): CsvMetricHeaderProfile {
  const groups=new Map<string,NreRow[]>();
  for (const row of rows) { const name=normalizeCampaignName(row.campaign_name); const group=groups.get(name) ?? [];group.push(row);groups.set(name,group); }
  return { all:numericMetricHeaders(headers,rows), campaigns:Object.fromEntries([...groups].map(([name,group])=>[name,numericMetricHeaders(headers,group)])) };
}
export function selectedMetricHeaders(profile: CsvMetricHeaderProfile | null | undefined, campaigns: Iterable<string>): string[] {
  if (!profile) return [];
  const names=[...campaigns];
  if (!names.length) return profile.all;
  const eligible=new Set(names.flatMap(name=>profile.campaigns[normalizeCampaignName(name)] ?? []));
  return profile.all.filter(header=>eligible.has(header));
}
