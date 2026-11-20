/**
 * Shared contract for campaign/ad-set commentary, independent of client or import method.
 * The engine owns every displayed fact. AI may select one approved, objective-specific
 * next step; its free text, numbers and diagnoses are never published as report copy.
 */
import type { AiContext, Platform } from "../nre/report-data";
import type { AiCopy } from "../pptx/fill-tags";

export interface CommentaryAction { id: string; text: string }

function available(value: string): boolean {
  return /\d/.test(value) && !/NaN|Infinity|not available|N\/A/i.test(value);
}
function entity(ctx: AiContext): string { return ctx.entityLabel ?? "campaign"; }
function sentenceLabel(label: string): string {
  const lower = label.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
function hasResultCount(ctx: AiContext): boolean {
  return available(ctx.results) && Number.isFinite(ctx.resultsNum) && ctx.resultsNum >= 0;
}
function frequency(ctx: AiContext): string | null {
  return Number.isFinite(ctx.freq) && ctx.freq > 0 ? `${ctx.freq.toFixed(1)}x` : null;
}
function reachPhrase(ctx: AiContext): string {
  return `${ctx.reachEstimated ? "an estimated " : ""}${ctx.reach} people`;
}
function noDelivery(ctx: AiContext): boolean {
  // Zero spend alone is not evidence of a pause; attributed results can still arrive.
  return ctx.spendNum === 0 && (!available(ctx.impressions) || Number(ctx.impressions.replace(/,/g, "")) === 0)
    && hasResultCount(ctx) && ctx.resultsNum === 0;
}

export function commentarySummary(ctx: AiContext): string {
  const who = `This ${entity(ctx)}`;
  const spend = available(ctx.spend) ? `${ctx.spend} spend` : "unavailable spend";
  if (ctx.resultLabel === "REACH") {
    const delivered = available(ctx.reach)
      ? `${who} reached ${reachPhrase(ctx)} on ${spend} during the reporting period.`
      : `Reach is unavailable for this ${entity(ctx)} during the reporting period.`;
    const cost = available(ctx.reach) && available(ctx.cpr)
      ? `${sentenceLabel(ctx.costLabel)} was ${ctx.cpr}.`
      : `${sentenceLabel(ctx.costLabel)} is unavailable.`;
    return `${delivered} ${cost}`;
  }
  const goal = ctx.resultLabel.toLowerCase();
  if (!hasResultCount(ctx)) {
    return `${who} recorded ${spend} during the reporting period. ${sentenceLabel(goal)} and ${ctx.costLabel.toLowerCase()} are unavailable.`;
  }
  const result = ctx.resultsNum === 0 ? `no ${goal}` : `${ctx.results} ${goal}`;
  const cost = ctx.resultsNum === 0 || !available(ctx.cpr)
    ? `${sentenceLabel(ctx.costLabel)} is unavailable.`
    : `${sentenceLabel(ctx.costLabel)} was ${ctx.cpr}.`;
  return `${who} recorded ${result} on ${spend} during the reporting period. ${cost}`;
}

/** These are possible verification/tests, never diagnoses or unprovided benchmarks. */
export function commentaryActions(ctx: AiContext): CommentaryAction[] {
  const compare = { id:"compare_periods", text:"Compare the same result and cost measures with the next reporting period before changing spend." };
  const message = { id:"test_message", text:"Test one message variation next period and compare the same result and cost measures with this period." };
  if (noDelivery(ctx)) return [{id:"check_delivery",text:"Check the selected dates and delivery status before drawing a performance conclusion."}];
  if (ctx.resultLabel !== "REACH" && !hasResultCount(ctx)) return [{id:"verify_source",text:"Check the selected dates and exported result columns before drawing a performance conclusion."}];
  const label = ctx.resultLabel.toUpperCase();
  if (label === "META FORM LEADS") return [
    {id:"review_form",text:"Review instant-form completion data before testing one change to the form questions."},
    {id:"review_lead_quality",text:"Review lead quality in your CRM before deciding whether to change spend."},
    message,
  ];
  if (/MESSAG|CONVERSATION/.test(label)) return [
    {id:"review_conversations",text:"Review conversation outcomes before testing one change to the message or response flow."},message,compare,
  ];
  if (/CALL/.test(label)) return [
    {id:"review_calls",text:"Review call outcomes before testing one change to the ad or call-handling flow."},message,compare,
  ];
  if (/\bAPP\b|INSTALL/.test(label)) return [
    {id:"review_app",text:"Review app-event reporting before testing one store-listing or ad-message change."},message,compare,
  ];
  if (/PURCHASE/.test(label)) return [
    {id:"review_purchase_value",text:"Review purchase value and attribution before assessing return on ad spend."},message,compare,
  ];
  if (/WEBSITE|LANDING PAGE/.test(label)) return [
    {id:"review_website",text:"Verify the reported website result against your tracking data before changing spend."},message,compare,
  ];
  if (label === "LINK CLICKS") return [
    {id:"review_destination",text:"Review destination loading and landing-page-view data before testing one message change."},message,compare,
  ];
  // Reach, engagement, video views and unknown result labels have no evidence
  // for a lead, purchase, website, CRM or app diagnosis. Keep their actions neutral.
  return [compare,message];
}

function commentaryObservation(ctx: AiContext, platform: Platform): string {
  if (noDelivery(ctx)) return `No spend or result activity was recorded for this ${entity(ctx)} in the supplied period totals.`;
  if (ctx.resultLabel !== "REACH" && !hasResultCount(ctx)) return `The supplied totals do not provide an available ${ctx.resultLabel.toLowerCase()} count.`;
  if (ctx.resultLabel !== "REACH" && ctx.resultsNum === 0) {
    return `No ${ctx.resultLabel.toLowerCase()} were recorded${available(ctx.spend) ? ` on ${ctx.spend} spend` : ""}; ${ctx.costLabel.toLowerCase()} is unavailable.`;
  }
  const f = frequency(ctx);
  if (f && available(ctx.reach)) return `Average frequency was ${f} across ${reachPhrase(ctx)} reached.`;
  if (available(ctx.ctr)) return `${platform === "META" ? "CTR (all)" : "Click-through rate"} was ${ctx.ctr}.`;
  return "The supplied figures describe this reporting period only.";
}

export function buildReportCommentary(ctx: AiContext, platform: Platform = "META", actionId?: string): AiCopy {
  const actions = commentaryActions(ctx);
  const action = actions.find(option => option.id === actionId) ?? actions[0];
  return { summary:commentarySummary(ctx), insights:`${commentaryObservation(ctx,platform)} ${action.text}` };
}

export function shouldSelectCommentaryAction(ctx: AiContext): boolean {
  return ctx.spendNum > 0 && (ctx.resultLabel === "REACH" ? available(ctx.reach) : hasResultCount(ctx) && ctx.resultsNum > 0);
}

export function commentarySelectionPrompt(ctx: AiContext, platform: Platform): string {
  return "Select exactly one next-step action for a reporting-period observation. Return only JSON with one property: {\"action\":\"approved_action_id\"}. " +
    "Do not write a summary, numbers, performance judgments, causes or recommendations outside the approved choices. " +
    "The engine supplies the factual summary and observation. These are aggregates for one period, with no benchmark, prior-period comparison, CRM quality, form completion or creative evidence. " +
    "Names are intentionally omitted; use the supplied objective, entity and facts only.\n" + JSON.stringify({
      platform,entity:entity(ctx),period:ctx.dateRange,objective:ctx.resultLabel,
      facts:{spend:ctx.spend,results:ctx.results,costLabel:ctx.costLabel,cost:ctx.cpr,reach:ctx.reach,reachEstimated:ctx.reachEstimated??false,frequency:frequency(ctx),ctr:ctx.ctr},
      actions:commentaryActions(ctx),
    });
}

export function selectedCommentaryAction(raw: string, ctx: AiContext): string | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const record = value as Record<string,unknown>;
    if (Object.keys(record).length !== 1 || typeof record.action !== "string") return undefined;
    return commentaryActions(ctx).some(action => action.id === record.action) ? record.action : undefined;
  } catch { return undefined; }
}

/** A cache may retain a safe action, but cannot retain old facts or arbitrary prose. */
export function cachedCommentaryAction(saved: AiCopy | undefined, ctx: AiContext, platform: Platform): string | undefined {
  return commentaryActions(ctx).find(action => saved?.insights === buildReportCommentary(ctx,platform,action.id).insights)?.id;
}
