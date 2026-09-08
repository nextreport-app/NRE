/** Compact, distinguishable labels for campaigns on the visual chart slide. */

export const CHART_CAMPAIGN_LABEL_MAX = 24;

const DELIMITERS = [" | ", " - ", " – ", " — ", " / ", ": ", " · "] as const;

function truncateLabel(label: string, max: number): string {
  const trimmed = label.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function longestCommonPrefix(names: string[]): string {
  if (names.length === 0) return "";
  let prefix = names[0]!;
  for (const name of names.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < name.length && prefix[i]!.toLowerCase() === name[i]!.toLowerCase()) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }
  return prefix.replace(/\s+\S*$/, "").trim();
}

function delimiterTail(name: string): string | null {
  for (const delim of DELIMITERS) {
    if (!name.includes(delim)) continue;
    const tail = name.split(delim).pop()?.trim();
    if (tail) return tail;
  }
  return null;
}

function suffixAfterPrefix(full: string, prefix: string): string {
  if (!prefix || full.length <= prefix.length) return full.trim();
  return full.slice(prefix.length).replace(/^[\s|–—\-:/·]+/, "").trim() || full.trim();
}

function uniqueTail(full: string, length = 14): string {
  const compact = full.replace(/\s+/g, " ").trim();
  if (compact.length <= length) return compact;
  return compact.slice(-length).replace(/^[\s|–—\-:/·]+/, "").trim() || compact.slice(-length);
}

/**
 * Build short labels that stay distinguishable when campaign names share a long prefix
 * (e.g. "Sherwood Tractor Sales | LPV A" vs "Sherwood Tractor Sales | LPV B").
 */
export function buildCampaignShortLabels(names: string[], max = CHART_CAMPAIGN_LABEL_MAX): Map<string, string> {
  const uniqueNames = [...new Set(names.filter((name) => name.trim().length > 0 && name !== "Other"))];
  const result = new Map<string, string>();
  if (uniqueNames.length === 0) return result;
  if (uniqueNames.length === 1) {
    result.set(uniqueNames[0]!, truncateLabel(uniqueNames[0]!, max));
    return result;
  }

  const trimmed = uniqueNames.map((name) => name.trim());
  const commonPrefix = longestCommonPrefix(trimmed);

  const delimiterTails = trimmed.map((name) => delimiterTail(name));
  const delimiterDistinct =
    delimiterTails.every(Boolean) && new Set(delimiterTails.map((tail) => tail!.toLowerCase())).size === trimmed.length;

  const candidates = trimmed.map((full, index) => {
    if (delimiterDistinct) return delimiterTails[index]!;
    const suffix = suffixAfterPrefix(full, commonPrefix);
    if (suffix && suffix.toLowerCase() !== full.toLowerCase()) return suffix;
    return full;
  });

  const used = new Set<string>();
  for (let i = 0; i < trimmed.length; i++) {
    const full = trimmed[i]!;
    let label = truncateLabel(candidates[i]!, max);

    if (used.has(label.toLowerCase())) {
      label = truncateLabel(uniqueTail(full, Math.min(max, 16)), max);
    }
    if (used.has(label.toLowerCase())) {
      label = truncateLabel(`${label} (${i + 1})`, max);
    }

    used.add(label.toLowerCase());
    result.set(full, label);
  }

  return result;
}

/** Rank-prefixed label for color matching between donut legend and result bars. */
export function formatRankedCampaignLabel(rank: number, shortLabel: string): string {
  return `${rank}. ${shortLabel}`;
}
