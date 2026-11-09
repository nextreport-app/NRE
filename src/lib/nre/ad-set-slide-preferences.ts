import { adSetKey, type AdSetGroup } from "./ad-sets";

/** Versioned opt-in memory; old exclusion-only arrays cannot prove an inclusion. */
export interface AdSetSlidePreferences {
  policy: "optional-ad-set-slides-v1";
  knownKeys: string[];
  selectedKeys: string[];
}
export function parseAdSetSlidePreferences(raw: string | null | undefined): AdSetSlidePreferences | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.policy !== "optional-ad-set-slides-v1" || !Array.isArray(value.knownKeys) || !Array.isArray(value.selectedKeys)
      || !value.knownKeys.every((key: unknown) => typeof key === "string") || !value.selectedKeys.every((key: unknown) => typeof key === "string")) return null;
    return value;
  } catch { return null; }
}
export function allAdSetKeys(groups: AdSetGroup[]): string[] {
  return groups.flatMap(group => group.adSetNames.map(name => adSetKey(group.campaignName, name)));
}
/** No saved opt-in means no extra slides, regardless of the number of ad sets. */
export function resolveDefaultSelectedAdSets(groups: AdSetGroup[], raw?: string | null): string[] {
  const memory = parseAdSetSlidePreferences(raw);
  if (!memory) return [];
  const selected = new Set(memory.selectedKeys);
  const known = new Set(memory.knownKeys);
  return allAdSetKeys(groups).filter(key => known.has(key) && selected.has(key));
}
export function newAdSetSlideKeys(groups: AdSetGroup[], raw?: string | null): string[] {
  const memory = parseAdSetSlidePreferences(raw);
  if (!memory) return []; // First import has no earlier inventory to compare with.
  const known = new Set(memory.knownKeys);
  return allAdSetKeys(groups).filter(key => !known.has(key));
}
/** Preserve choices for sets absent from this import, e.g. paused campaigns. */
export function buildAdSetSlidePreferences(groups: AdSetGroup[], selectedKeys: string[], previous?: string | null): AdSetSlidePreferences {
  const memory = parseAdSetSlidePreferences(previous);
  const current = new Set(allAdSetKeys(groups));
  return {
    policy: "optional-ad-set-slides-v1",
    knownKeys: [...new Set([...(memory?.knownKeys ?? []), ...current])],
    selectedKeys: [...new Set([...(memory?.selectedKeys ?? []).filter(key => !current.has(key)), ...selectedKeys.filter(key => current.has(key))])],
  };
}
/** Only selections under included campaigns may become report slides. */
export function activeAdSetKeys(groups: AdSetGroup[], selected: ReadonlySet<string>, campaigns: ReadonlySet<string>): string[] {
  return allAdSetKeys(groups.filter(group => campaigns.has(group.campaignName))).filter(key => selected.has(key));
}
export function supportsAdSetSlides(reportType: string): boolean {
  return !["COMPARISON", "DAY_BREAKDOWN"].includes(reportType);
}
