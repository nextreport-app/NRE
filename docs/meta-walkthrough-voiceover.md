# Meta walkthrough — voiceover script

Use this when **re-recording** with narration, or paste sections into **Loom speaker notes** while you click through the UI. The same steps appear on `/help/download` next to the embedded video.

---

## Part 1 — Export from Meta Ads Manager

In Meta Ads Manager, open the account you report on. You should see your live campaigns on the main screen.

From the left menu, go to Ads Reporting. This is the reporting workspace where we build a day-wise export for NextReport.

Click Create report. Select the campaigns you want in this client report — usually the same set you show the client each week or month.

Set the date range. Last thirty days is a good default — it covers weekly and monthly decks and gives NextReport enough history for charts.

On the right, open Breakdown and select Day. NextReport needs one row per day per campaign — not a single totals row.

Open Metrics and add the columns that match your campaign objectives — for example link clicks and landing page views for traffic, leads and cost per lead for lead gen, purchases and return on ad spend for sales. Reach, impressions, amount spent, and frequency are typically already included. Skip columns you do not use; add any extras your client expects to see.

Save this report layout in Ads Manager so next time you only change the date range and export — you do not rebuild the column list.

Export the table as CSV. That file is what you will upload on the NextReport import step.

---

## Part 2 — Build the report in NextReport

Go to nextreport dot in. If you are already signed in, click Go to Dashboard.

On My Clients, select the client workspace that matches this ad account — name, currency, and logo carry through to the deck.

Click Generate report on that client to open the four-step report wizard.

On Import, choose the report type and reporting period, upload the CSV you just exported, and click Analyze campaign data.

On Campaigns, confirm which campaigns belong in this deck and set the primary result objective for each — leads, purchases, traffic, reach, and so on.

On Metrics, preview the KPI chips on each campaign slide. Remove metrics you do not need or add extras that were in your export.

On Generate, confirm the dates and report type, then run Generate report. NextReport builds your branded PowerPoint and live share link.

When generation finishes, preview the deck, download PowerPoint, save to Google Drive if you use it, or copy a live link to send the client — no PowerPoint install required on their side.

---

## Adding audio to an existing Loom (free vs paid)

| Option | How |
|--------|-----|
| **Re-record with mic** | Loom → record again with the script above on a second monitor or printed. |
| **Loom speaker notes** | Paste this script into notes; read while recording (no auto audio on free). |
| **Loom AI voice / dubbing** | Check Loom’s current plan features — availability changes by tier. |
| **External editor** | Download MP4 (paid) or re-record with OBS → add voice in CapCut, DaVinci Resolve, or iMovie → upload to YouTube and embed. |
| **No audio** | Keep silent Loom; users follow the on-page chapter list on `/help/download`. |

After you add Loom **chapters** (paid feature), you can align timestamps to each numbered step in `src/lib/meta-walkthrough-script.ts`.
