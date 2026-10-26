# NextReport product review and cautious engineering plan

26 October 2026 (IST). The founder reports **no outside agencies have tried or paid yet**. This is a pre-validation product, despite substantial implementation work.

Scope: current repository and locally rendered homepage at desktop/mobile sizes; local authenticated clients page and wizard Import screen using a disposable account that was deleted afterward; source review of the remaining wizard/reporting paths. Direct access to nextreport.in was blocked by the environment's network proxy. This is not a claim that the deployed version matches the local checkout, nor a completed live customer-journey test.

## Commercial assessment

The problem is credible: repetitive agency reporting is frequent, measurable, and often owned by a buyer who values saved specialist time. Your own agency experience provides access and domain understanding. It does not establish other agencies' willingness to pay.

The best initial buyer is a Meta-focused freelancer or small agency managing roughly 5–30 client brands, already delivering recurring PowerPoint/Slides reports. A dashboard-first agency satisfied with its current reporting system is a less promising first customer. India and international agencies can both fit; recruit through your strongest existing relationships rather than assuming country alone determines demand.

There is a plausible business here. No reliable success probability follows from the current evidence. Three months of development and many supported report types are sunk effort, not proof of demand. The next evidence should be repeat usage and actual payments. I would avoid launching a broad accuracy promise while the engine still has unresolved false-green cases.

### What the moat could become

Not defensible by itself: CSV upload, a four-step wizard, a dark theme, generated prose, PowerPoint templates, or a generic Meta API connection. These are reproducible features.

A stronger advantage would combine:

- A growing, approved corpus of real export shapes and independently verified report outputs.
- An explanation for each reported number: source rows, event identity, date window, numerator/denominator, and whether it is observed or estimated.
- Saved client-specific reporting preferences, approved templates, and a workflow agencies repeat every week.
- Fast resolution of unfamiliar exports with regression coverage, rather than campaign-specific guesses.

Correctness is initially the entry requirement. It becomes an advantage through evidence and operational reliability, not through saying “accurate” in marketing copy. Keep customer data private and obtain permission for sanitized fixtures. Existing alternatives include manual spreadsheets/slides, Looker Studio, and established agency reporting tools; this review has not researched current competitor prices or market shares.

### A practical validation cycle

1. Recruit 5–10 qualified agencies/freelancers through your network, including some outside India if access is easy. Ask for the last report they actually sent, its source export, time spent, and who approves it. Do not lead with a feature survey.
2. Work alongside the first few users on their own files. Have them compare the generated deck to the export and approve the figures. Founder-assisted reconciliation is acceptable in a small paid pilot; concealment of manual intervention is not.
3. Ask for payment when the report is accurate and useful. A free signup or polite interest is weaker evidence than payment and repeated reporting.
4. Track first accurate export, time to first approved deck, reports actually sent, week-2/week-4 reuse, support minutes per report, paid conversion, cancellations and their reasons. Do not infer retention from login counts.
5. A useful **internal milestone**, not a statistically validated market threshold: at least 3 agencies paying and using the product for 4 consecutive reporting cycles, with no unexplained material metric discrepancies. Investigate non-users rather than adding features on their behalf.

Keep Meta CSV as the supported production promise during this work. Test API parity separately. Avoid paid acquisition until a few users can repeatedly reach an approved report without founder intervention.

## Pricing recommendation

Current code has ₹799 / ₹1,299 and $9 / $15 monthly plans, with 10 client workspaces and unlimited workspaces respectively. Those are implementation facts, not confirmation of actual production checkout settings or subscriptions.

I would not cut prices to compensate for unreliable output. During a limited pilot, the existing prices are enough to test whether anyone will pay. Once reliability and repeat usage are established, test the following **hypothesis for new plans**, without silently changing existing agreements:

| Plan hypothesis | India/month | International/month | Client workspaces |
|---|---:|---:|---:|
| Agency | ₹1,499 | $19 | 10 |
| Professional | ₹2,999 | $49 | 25 |

Allow larger agencies to request a quote. Keep ordinary reporting generous, but define fair usage before promising unlimited compute/storage/support. Workspaces are easier for agencies to understand than credits per slide. Show tax treatment clearly and support a working payment method for the country before marketing checkout there. These are pricing experiments, not recommendations backed by conversion data. No prices or billing behavior were changed in this task.

Model hosting, file storage/egress, AI usage, payment fees, refunds and support time per active agency. If your product saves a specialist several hours each month, low price is not necessarily the strongest selling point; a credible proof of saved time matters more. Do not publish generic “average agency” time-saving statistics without evidence or a clear illustrative label.

### Confirmed pricing display drift

`currency-pricing.tsx`, `subscribe-plan-cards.tsx`, and `razorpay.ts` maintain separate price tables. Annual figures currently differ:

| Plan | Billing card INR / USD | Server formula INR / USD before tax |
|---|---|---|
| Agency | ₹6,710 / $77 | ₹7,670.40 / $86.40 |
| Professional | ₹16,310 / $192 | ₹12,470.40 / $144.00 |

The public pricing component shows rounded ₹7,670 / $86 and ₹12,470 / $144. This is a real display-consistency problem even before testing a new price. Fix it in a separate PR by extracting a client-safe price catalogue and formatting shared numeric amounts; do not import the server-only Razorpay client into browser code. Check both currencies, monthly/annual, tax wording, and any actual Razorpay subscription-plan amount. A display fix should not modify the charged amount.

## Brand, homepage, and UX

### Keep the visual identity

The navy and amber palette is coherent with an agency reporting product. Keep both dark and light deck templates and the existing theme choice. The local mobile homepage had no horizontal overflow at 390px in the review. This is not a complete accessibility or responsive audit.

Refine usability rather than starting a redesign. White text on amber `#f5b45a` has approximately **1.82:1** contrast; navy `#0d1b2e` on that amber is approximately **9.53:1**. Some selected cards/buttons use white on amber. Use dark text there, preserve the brand, and test keyboard focus/disabled states. Light-mode amber text on the cream canvas also needs contrast attention. Do not infer a whole design is accessible from those two swatches alone.

### Homepage priorities

The page looks coherent, but is long and repeats the same time-saving claim across many sections. Keep the sample report and actual product visual. Suggested order: precise offer and sample deck → short walkthrough → before/after evidence → included capabilities → transparent pricing → real customer proof once obtained → final action. Move the sample report nearer the hero and make one CTA dominant.

Suggested positioning: “Turn your Meta Ads CSV into a branded client report you can check against the source.” Avoid an unconditional guarantee of accuracy until supported. Mention future platforms lower on the page rather than letting the first screen read like a list of unavailable features. Preserve feature flags and deliberate visibility decisions until reviewed separately.

Concrete trust gaps:

- The hero mockup shows **$2,847 spend, 34 leads, $8.42 CPL**. Its own arithmetic gives **$83.74 CPL**. Several locale copies repeat the figures. These are illustrative marketing values, not proof of an engine error, but a reporting product's demo must reconcile too. Correct from one shared numeric sample and label it illustrative.
- Three “early users” quotes are attributed to Mumbai, Dubai and Austin. Because no outside agencies have used the product yet, their provenance needs checking. Do not assert they are fabricated without confirmation; if placeholders, remove them from public customer-proof sections and replace them with a candid pilot invitation until genuine permissioned quotes exist.
- Verify the downloadable sample itself, not just screenshots. Use the exact generated deck and approved source data for sales demonstrations.
- Claims such as “every slide gets AI insights” should reflect actual configured behavior. Optional/missing AI credentials must not make the purchase promise misleading.

### Keep four steps, reduce decisions inside them

1. **Import:** default to the client's supported source/report type, keep the existing Weekly recommendation, give one concise export recipe and a validated example file. Keep detailed help available without making the user read it all. Preserve advanced report types under the existing disclosure. Unavailable integrations need a clear status.
2. **Campaigns:** show selected/excluded count and spend, actual reporting dates, and why a campaign is unchecked. Do not silently change selection memory or the existing low-spend policy. Names are not stable identity; use IDs when exports provide them and detect ambiguous same-name entities.
3. **Metrics:** make auto-detected versus user-confirmed choices visible. Explain which source field proves a primary result. Require a choice for genuinely ambiguous objectives; do not ask the user to manually repair ordinary counts. Keep the established eight-card packs and optional continuation behavior. Distinguish a primary optimization result from secondary funnel metrics.
4. **Generate:** show date coverage, included campaigns, per-objective totals and exact checks. A green label must name what was checked and what is estimated/unverified. Make a mismatch actionable with row references. Preserve drafts and provide clear progress/retry states. Keep the difference between generating a report, editing it, and publishing its client share clear.

For returning users, offer a review of previously saved settings and only ask about changed/ambiguous inputs. Do not remove the Campaigns review or bypass existing confirmation choices without testing that change. The number of steps is less important than cognitive load and confidence in the output.

## Engineering findings and order of work

The detailed lineage audit is [NRE_ACCURACY_AUDIT.md](NRE_ACCURACY_AUDIT.md). This follow-up also inspected campaign selection, metric availability/selection, slot assignment/packs, dynamic metrics/CTR/CPC, preview fingerprints/caching, wizard generation controls, billing display and homepage copy.

| Priority | Finding | Action |
|---|---|---|
| P0 | Cost/rate cells added to event quantities | **Locally fixed** in the count extractor; eight failing-before/passing-after cases, release gate updated |
| P0 | Explicit objective can be overwritten during lossy aggregation; mixed goals collapse to one campaign label | Preserve immutable primary event evidence, stable IDs and typed per-goal buckets; migrate standard MTD first |
| P0 | Verification shares classification mistakes and omits some rate/objective checks | Source-contract checks + spend/result conservation + complete scope coverage + final PPTX-cell checks |
| P0 | Reach unique-period totals and CPM units differ across consumers | Separate exact/estimated unique counts; define ratio scale in metric catalogue and use it in all consumers |
| P1 | Raw dynamic CPC helper recognizes spend in USD/plain headers only, despite other currency variants in the dictionary | Share validated currency-aware header binding. Reproduced INR fallback: true CPC(all) ₹10, selected dynamic CPC(all) ₹100 when it falls back to 10 link clicks rather than 100 all-clicks |
| P1 | Generic percentage/ratio aggregation averages nonzero daily rates | Bind denominator/weight per metric; don't blanket-replace every ratio with one formula. A direct dynamic CTR probe gives 5.5% for 10%/1% on 1,000/9,000 impressions, while the weighted rate is 1.9%. Standard baseline CTR paths already have a weighted helper; migrate the divergent fallback |
| P1 | Campaign names are used as identity; selection casing policies differ | Retain IDs, detect collisions/renames, normalize comparison policy consistently. Preserve null/all versus empty/no-selection behavior |
| P1 | Preview cache omits resolved as-of/engine version/previous-file version and other dependencies | Freeze one report plan/snapshot and fingerprint all inputs; don't independently resolve windows at verify/generate time |
| P1 | DAILY/QTD/YTD and previous-month verification scopes can diverge | Test each report type with explicit source windows and selection/override cases before migrating |
| P1 | Wrong annual prices shown in billing UI | Shared client-safe price catalogue, no new commercial price until separately approved |
| P1 | Marketing example math and customer-proof provenance | Independently correct/verify source evidence; separate marketing-copy review |

The INR and dynamic CTR probes identify divergent helper paths; they do not prove every default slide uses those paths. The default builder already overrides some selected metric values with baseline results. Test both automatic packs and explicit metric selections for each reported issue before changing a whole pipeline.

Do not assume every existing formula is wrong. The weighted CTR/CPC helpers, parts of raw-row result counting, raw-row campaign/ad-set display, current shared standard builder, snapshot-based worker payload, eight-card packs, and profile-specific fixtures are useful foundations. Preserve them until a replacement proves better against the same approved input/output corpus.

## Initial bounded fix (superseded by the authorized implementation)

The change excludes headers containing cost/CPA/CPC/CPM/CPL/ROAS/rate/ratio or `%` from the raw **event-count** keyword extractor. It does not change objective priorities, event alias summation, rounding, dates, selections, themes, billing, integrations or report types. Exact schema-driven binding remains the eventual replacement; this guard fixes the proven unit contamination without undertaking that migration now.

Release limitation: existing stored decks and cached preview snapshots are not rewritten. Validate the deployed fix with a fresh upload session; engine-version cache invalidation remains an open follow-up.

Validation:

- Eight new regression cases fail on the original extractor and pass after the fix, including campaign and MTD checkout/cart count + CPR.
- Updated release gate: **57 passed**.
- Related creative/objective/detection/dynamic-metric/availability/selector/campaign suites: **320 passed**.
- API-route suite: **27 passed**.
- Dark/light generated PPTX tables both contain **2 / $50.00** for the checkout case, replacing the baseline **52 / $1.92**.
- Targeted lint: no errors; one existing unused-import warning in objective.ts.
- Production build against the local test database: **passed**, including Prisma migration check, compilation, TypeScript and static generation.

Passing these tests is evidence for this bounded fix, not a declaration that all previously found reporting bugs are resolved.

No push, PR merge, production deployment, new price, theme redesign, integration launch or production database write is implied by preparing these local changes. See [HOW_TO_SHIP_A_CHANGE.md](HOW_TO_SHIP_A_CHANGE.md) for the beginner release workflow and exact first-fix file list.


## Authorized implementation follow-up

The later request authorizes frontend/backend implementation and a PR. This branch includes the core accounting changes described in [NRE_ACCOUNTING_CONTRACT.md](NRE_ACCOUNTING_CONTRACT.md), row-level API/manual diagnostics, shared billing display prices, corrected illustrative hero arithmetic, a pilot invitation replacing unverified testimonials, sample placement, amber-button contrast, selection summary, and scoped verification copy.

The existing four-step wizard, eight-card packs, templates, monthly charges, discount policy, feature gates, and production schema remain intact. The deployment guide now describes this broader branch. Recommendations above that are not represented in the final diff remain recommendations, not completed features. In particular, external pilot validation, proven acquisition economics, a full identity/grain migration, and real paired API snapshots remain outstanding.
