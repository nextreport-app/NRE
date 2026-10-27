# Client-readable performance charts

Updated 27 October 2026 (IST). The visual model is shared by native editable PPT shapes, SVG preview and browser reports. This change preserves campaign selection, reporting windows and source result totals. Engine v7 invalidates older chart semantics in new snapshots; existing generated reports are not rewritten.

## Meaning and identity

- The left donut shows **Spend by Objective**, aggregating all campaigns with the same resolved result objective before building slices. One goal produces one 100% segment; mixed goals produce separate segments with goal names, spend shares and exact spend. Website and instant-form leads remain distinct. Campaign names are not repeated in this legend.
- The right campaign bars retain their ranks, short names, colors, ordering, counts, spend and cost labels. Donut colors identify objectives; campaign bars use the matching objective color, so repeated goals share a color. Short labels retain distinguishing tails, including underscore-delimited names. Original campaign names remain in the model and browser tooltips.
- When all campaigns report the same event type, bars rank and scale by that result count. The scale starts at zero and ends at the largest shown count; technical scale text is omitted. Actual counts appear at the right; spend and cost per result sit below the bar.
- Mixed result types use spend for ranking and bar length, with an explicit scale description. Different result units are not added into a fictitious aggregate Results count or compared as if equivalent.
- Resolved source event labels are authoritative. A campaign name cannot relabel a lead count as Reach or Link clicks in the renderer.
- Up to five campaign bars are shown; their top-five limit is stated. The donut includes spend from every campaign, including those outside the bars. Up to five objectives are listed individually, with remaining objective spend grouped as Other objectives. Unassigned spend exposes inconsistent supplied totals.

The donut and two-line objective legend are centered. Layout scales the ring to reserve room for up to six legend rows; excess objectives remain grouped.

## Numbers and display

Totals and campaign spend preserve cents; spend-share labels use one decimal percentage. Ring geometry uses the unrounded shares. Blended cost is total spend divided by the relevant result total, with the shared objective-rate helper retaining per-1,000 Reach/Impressions units. Fractional results are retained. Unavailable costs remain unavailable, and a single maximum bar is no longer arbitrarily capped at 75%.

A single 100% SVG donut uses a visible full-circle primitive; a start=end arc can otherwise disappear. Native and SVG geometry, labels and scale text use the same model. Native metric text boxes reserve sufficient line height for Poppins, and the five-row block stays inside the slide panel. Dark/light templates retain their existing background and card palettes.

## Verification

Anonymous contract tests cover repeated-goal campaigns, objective aggregation independent of campaign bars, exact counts and weighted costs, mixed-goal spend scales, authoritative event identity, omitted campaigns, fractional counts, per-1,000 costs, full-circle rendering, and native text-box geometry. Existing chart/date/layout tests continue to cover the shared renderers. Private client CSVs and deck previews stay outside Git.

Visual checks should include native dark/light PPT export, browser desktop/mobile, and long/shared-prefix campaign names. Rendering via LibreOffice is an interoperability check; PowerPoint and Google Slides can use different font substitutions.

## Separate content gap

Traffic/landing-page-view metrics do not establish profitability, sales quality, purchase conversion loss or a justified percentage budget increase. Generated commentary making those claims needs a separate evidence/guardrail review. This chart change does not alter AI prompts, actual audience estimation, OAuth connections or calculation formulas outside the chart's per-unit summary display.
