/** Shared UI/engine/PPT limits. The request-level union can span many campaigns. */
export const MAX_METRICS_PER_SLIDE = 8;
export const MAX_TOTAL_METRICS = 64;
export const MAX_METRIC_UNION = 1024;
export const METRIC_GUIDE_ENTRIES_PER_SLIDE = 12;

/** Balance extras across the minimum number of pages, retaining selection order. */
export function paginateExtraMetrics<T>(extras: readonly T[]): T[][] {
  if (!extras.length) return [];
  const count = Math.ceil(extras.length / MAX_METRICS_PER_SLIDE);
  const size = Math.floor(extras.length / count);
  const remainder = extras.length % count;
  let offset = 0;
  return Array.from({ length: count }, (_, index) => {
    const length = size + (index < remainder ? 1 : 0);
    const page = extras.slice(offset, offset + length);
    offset += length;
    return page;
  });
}

export function metricSlideSizes(count: number): number[] {
  return count <= MAX_METRICS_PER_SLIDE ? [count] : [MAX_METRICS_PER_SLIDE, ...paginateExtraMetrics(Array.from({ length: count - MAX_METRICS_PER_SLIDE })).map(page => page.length)];
}

/** Unique selected cards, also dropping legacy continuation filler duplicates. */
export function allSlideMetrics<T extends { key: string }>(slide: { dynamicMetrics: readonly (T | null)[]; additionalMetricsSlide?: readonly (T | null)[] }): T[] {
  const seen = new Set<string>();
  return [...slide.dynamicMetrics, ...(slide.additionalMetricsSlide ?? [])].filter((metric): metric is T => {
    if (!metric || seen.has(metric.key)) return false;
    seen.add(metric.key);
    return true;
  });
}
