import type { WebsiteSnapshot } from "./model";
export interface TrafficMetrics {
  sessions: number | null;
  engagementRate: number | null;
  keyEvents: number | null;
  sessionKeyEventRate: number | null;
}
export type WebsiteChangeState =
  | "review"
  | "positive"
  | "mixed"
  | "neutral"
  | "insufficient"
  | "limited"
  | "refresh";
export interface WebsiteChange {
  key: string;
  label: string;
  direction: "up" | "down";
  tone: "review" | "positive";
  current: number;
  previous: number;
  change: number;
  unit: "percent" | "points";
  note: string;
}
export const WEBSITE_CHANGE_LABELS: Record<WebsiteChangeState, string> = {
  review: "Changes to review",
  positive: "Positive changes",
  mixed: "Mixed changes",
  neutral: "No threshold crossed",
  insufficient: "More data needed",
  limited: "Data-quality limits",
  refresh: "Refresh needed",
};
/** Relative changes have no numeric value when a baseline is zero or missing. */
export function relativeChange(
  a: number | null | undefined,
  b: number | null | undefined,
) {
  return a != null && b != null && b > 0 ? (a / b - 1) * 100 : null;
}
export function trafficChanges(
  a: TrafficMetrics,
  b: TrafficMetrics,
): { state: WebsiteChangeState; signals: WebsiteChange[] } {
  const signals: WebsiteChange[] = [];
  const volumes =
    a.sessions !== null &&
    b.sessions !== null &&
    a.sessions >= 100 &&
    b.sessions >= 100;
  const add = (
    key: string,
    label: string,
    tone: WebsiteChange["tone"],
    current: number,
    previous: number,
    unit: WebsiteChange["unit"],
    note: string,
  ) => {
    const change =
      unit === "points"
        ? (current - previous) * 100
        : relativeChange(current, previous)!;
    signals.push({
      key,
      label,
      tone,
      current,
      previous,
      unit,
      change,
      direction: change >= 0 ? "up" : "down",
      note,
    });
  };
  // Key events are defined by the property's owner; this is not automatically a lead/purchase measure.
  if (
    volumes &&
    a.sessionKeyEventRate !== null &&
    b.sessionKeyEventRate !== null &&
    (b.keyEvents ?? 0) >= 5 &&
    b.sessionKeyEventRate * b.sessions! >= 5
  ) {
    const change = relativeChange(a.sessionKeyEventRate, b.sessionKeyEventRate),
      points = (a.sessionKeyEventRate - b.sessionKeyEventRate) * 100;
    if (
      a.sessionKeyEventRate === 0 &&
      b.sessionKeyEventRate > 0 &&
      a.keyEvents === 0 &&
      a.sessions! >= b.sessions! * 0.8
    )
      add(
        "key-events-stopped",
        "Sessions with a key event",
        "review",
        0,
        b.sessionKeyEventRate,
        "points",
        "GA4 reported no sessions with a configured key event while traffic continued. Verify the period and key-event definitions; recent data can change.",
      );
    else if (change !== null && change <= -20 + 1e-8 && points <= -0.5 + 1e-8)
      add(
        "key-rate-down",
        "Sessions with a key event",
        "review",
        a.sessionKeyEventRate,
        b.sessionKeyEventRate,
        "points",
        "A smaller share of sessions included a configured key event. This does not identify a cause or establish lead/purchase quality.",
      );
    else if (
      change !== null &&
      change >= 20 - 1e-8 &&
      points >= 0.5 - 1e-8 &&
      (a.keyEvents ?? 0) >= 5 &&
      a.sessionKeyEventRate * a.sessions! >= 5
    )
      add(
        "key-rate-up",
        "Sessions with a key event",
        "positive",
        a.sessionKeyEventRate,
        b.sessionKeyEventRate,
        "points",
        "A larger share of sessions included a configured key event. Check what the property counts as a key event before judging business impact.",
      );
  }
  if (volumes && a.engagementRate !== null && b.engagementRate !== null) {
    const points = (a.engagementRate - b.engagementRate) * 100;
    if (Math.abs(points) >= 5 - 1e-8)
      add(
        points < 0 ? "engagement-down" : "engagement-up",
        "Engagement rate",
        points < 0 ? "review" : "positive",
        a.engagementRate,
        b.engagementRate,
        "points",
        "This is GA4's reported engagement definition, not a diagnosis of page quality or a guarantee of conversions.",
      );
  }
  if (a.sessions !== null && b.sessions !== null && b.sessions >= 100) {
    const change = relativeChange(a.sessions, b.sessions)!;
    if (change <= -30 + 1e-8)
      add(
        "sessions-down",
        "Sessions",
        "review",
        a.sessions,
        b.sessions,
        "percent",
        "Fewer sessions were reported. Compare channels and reporting dates before deciding what to investigate.",
      );
    else if (
      change >= 25 - 1e-8 &&
      a.engagementRate !== null &&
      b.engagementRate !== null &&
      a.engagementRate >= b.engagementRate - 0.03
    )
      add(
        "sessions-up",
        "Sessions",
        "positive",
        a.sessions,
        b.sessions,
        "percent",
        "More traffic was reported with a broadly maintained engagement rate. Traffic growth alone does not establish business success.",
      );
  }
  const positive = signals.some((s) => s.tone === "positive"),
    review = signals.some((s) => s.tone === "review");
  const state =
    review && positive
      ? "mixed"
      : review
        ? "review"
        : positive
          ? "positive"
          : volumes &&
              a.engagementRate !== null &&
              b.engagementRate !== null &&
              a.sessionKeyEventRate !== null &&
              b.sessionKeyEventRate !== null &&
              (a.keyEvents ?? 0) >= 5 &&
              (b.keyEvents ?? 0) >= 5 &&
              a.sessionKeyEventRate * a.sessions! >= 5 &&
              b.sessionKeyEventRate * b.sessions! >= 5
            ? "neutral"
            : "insufficient";
  return { state, signals };
}
export function websiteChanges(snapshot: WebsiteSnapshot, fresh: boolean) {
  const change = trafficChanges(snapshot.current, snapshot.previous);
  return {
    ...change,
    state: !fresh
      ? ("refresh" as const)
      : snapshot.warnings.length
        ? ("limited" as const)
        : change.state,
    signals: !fresh || snapshot.warnings.length ? [] : change.signals,
  };
}
export function channelComparisons(snapshot: WebsiteSnapshot) {
  const previous = new Map(
      (snapshot.previousChannels ?? []).map((c) => [c.name, c]),
    ),
    current = new Map(snapshot.channels.map((c) => [c.name, c]));
  return [...new Set([...current.keys(), ...previous.keys()])]
    .map((name) => {
      const a = current.get(name) ?? null,
        b = previous.get(name) ?? null;
      return {
        name,
        current: a,
        previous: b,
        change: relativeChange(a?.sessions, b?.sessions),
        availability: !snapshot.previousChannels
          ? "Previous data not loaded"
          : !a
            ? "Only previous period"
            : !b
              ? "Only current period"
              : null,
        analysis: a && b ? trafficChanges(a, b) : null,
      };
    })
    .sort((a, b) => {
      const weight = (r: typeof a) =>
        r.current?.sessions != null && r.previous?.sessions != null
          ? Math.abs(r.current.sessions - r.previous.sessions)
          : -1;
      return (
        weight(b) - weight(a) ||
        Math.max(b.current?.sessions ?? 0, b.previous?.sessions ?? 0) -
          Math.max(a.current?.sessions ?? 0, a.previous?.sessions ?? 0) ||
        a.name.localeCompare(b.name)
      );
    });
}
