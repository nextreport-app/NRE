/**
 * Meta CSV export → NextReport wizard — video chapters + voiceover script.
 * Shown beside the Loom embed; voiceover lines are for recording or Loom speaker notes.
 */

export interface WalkthroughStep {
  /** Short label in the on-page checklist */
  title: string;
  /** One line for readers watching the video */
  detail: string;
  /** Spoken narration (~one breath). Paste into Loom speaker notes or read while recording. */
  voiceover: string;
}

export interface WalkthroughPart {
  id: string;
  heading: string;
  steps: readonly WalkthroughStep[];
}

export const META_WALKTHROUGH_PARTS: readonly WalkthroughPart[] = [
  {
    id: "meta-ads-manager",
    heading: "Part 1 — Export from Meta Ads Manager",
    steps: [
      {
        title: "Open Ads Manager",
        detail: "Start on the Ads Manager home screen with your live campaigns visible.",
        voiceover:
          "In Meta Ads Manager, open the account you report on. You should see your live campaigns on the main screen.",
      },
      {
        title: "Open Ads Reporting",
        detail: "Use the Ads Reporting section — not the Campaigns export menu.",
        voiceover:
          "From the left menu, go to Ads Reporting. This is the reporting workspace where we build a day-wise export for NextReport.",
      },
      {
        title: "Create a report",
        detail: "Click Create report and pick the campaigns you include in client decks.",
        voiceover:
          "Click Create report. Select the campaigns you want in this client report — usually the same set you show the client each week or month.",
      },
      {
        title: "Set the date range",
        detail: "Choose Last 30 days (or the range that covers your reporting period).",
        voiceover:
          "Set the date range. Last thirty days is a good default — it covers weekly and monthly decks and gives NextReport enough history for charts.",
      },
      {
        title: "Break down by day",
        detail: "In Breakdown on the right, select Day. Day-wise rows are required.",
        voiceover:
          "On the right, open Breakdown and select Day. NextReport needs one row per day per campaign — not a single totals row.",
      },
      {
        title: "Choose metrics",
        detail:
          "Add columns for your objectives: CPC, CTR, link clicks, leads, cost per lead, website leads, landing page views, cost per LPV, purchases, cost per purchase, add to carts, checkouts, ROAS, and similar. Reach, impressions, amount spent, and frequency are usually already selected.",
        voiceover:
          "Open Metrics and add the columns that match your campaign objectives — for example link clicks and landing page views for traffic, leads and cost per lead for lead gen, purchases and return on ad spend for sales. Reach, impressions, amount spent, and frequency are typically already included. Skip columns you do not use; add any extras your client expects to see.",
      },
      {
        title: "Save the report",
        detail: "Save the view so metrics and breakdown stay selected next time.",
        voiceover:
          "Save this report layout in Ads Manager so next time you only change the date range and export — you do not rebuild the column list.",
      },
      {
        title: "Export CSV",
        detail: "Export table data as CSV and keep the file for upload.",
        voiceover:
          "Export the table as CSV. That file is what you will upload on the NextReport import step.",
      },
    ],
  },
  {
    id: "nextreport-wizard",
    heading: "Part 2 — Build the report in NextReport",
    steps: [
      {
        title: "Go to the dashboard",
        detail: "Open nextreport.in. If you are logged in, choose Go to Dashboard.",
        voiceover:
          "Go to nextreport dot in. If you are already signed in, click Go to Dashboard.",
      },
      {
        title: "Open the client",
        detail: "On My Clients, pick the client workspace for this account.",
        voiceover:
          "On My Clients, select the client workspace that matches this ad account — name, currency, and logo carry through to the deck.",
      },
      {
        title: "Start the wizard",
        detail: "Click Generate report on that client card.",
        voiceover:
          "Click Generate report on that client to open the four-step report wizard.",
      },
      {
        title: "Import the CSV",
        detail: "Choose the report type and period, upload your CSV, then Analyze campaign data.",
        voiceover:
          "On Import, choose the report type and reporting period, upload the CSV you just exported, and click Analyze campaign data.",
      },
      {
        title: "Campaigns and objectives",
        detail: "Confirm which campaigns are in the deck and set each campaign’s primary objective.",
        voiceover:
          "On Campaigns, confirm which campaigns belong in this deck and set the primary result objective for each — leads, purchases, traffic, reach, and so on.",
      },
      {
        title: "Review metrics",
        detail: "Preview KPI chips on each slide; remove or add metrics from your CSV columns.",
        voiceover:
          "On Metrics, preview the KPI chips on each campaign slide. Remove metrics you do not need or add extras that were in your export.",
      },
      {
        title: "Generate",
        detail: "Confirm dates and report type, then generate the deck.",
        voiceover:
          "On Generate, confirm the dates and report type, then run Generate report. NextReport builds your branded PowerPoint and live share link.",
      },
      {
        title: "Preview and deliver",
        detail: "Preview the deck, download .pptx, save to Google Drive, or share a live link with your client.",
        voiceover:
          "When generation finishes, preview the deck, download PowerPoint, save to Google Drive if you use it, or copy a live link to send the client — no PowerPoint install required on their side.",
      },
    ],
  },
] as const;

/** Flat list for Loom speaker notes or teleprompter — parts separated by blank lines. */
export function metaWalkthroughVoiceoverScript(): string {
  return META_WALKTHROUGH_PARTS.map((part) =>
    [part.heading, ...part.steps.map((s) => s.voiceover)].join("\n\n"),
  ).join("\n\n---\n\n");
}
