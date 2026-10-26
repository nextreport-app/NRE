/** Numeric meaning is independent of how a chip is formatted. */
export interface MetricAggregation {
  /** Totals-based ratio; a currency-formatted average is not additive. */
  numeratorKey?: string;
  denominatorKey?: string;
  ratioScale?: number;
}
