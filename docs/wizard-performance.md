# Wizard latency improvements

The targeted delays were repeated provider metadata calls, duplicate upload-context reads, serialized preference writes, sequential Insights windows and unbounded AI requests. Removing cookies or report files does not address those waits.

- Analyze fetches a custom-conversion catalogue only when the imported facts contain a custom conversion ID. Metrics reuses a captured catalogue, including an explicitly empty catalogue. Standard purchase/lead/click imports do not make those metadata requests.
- Analyze returns the normalized request identity for its campaign-spend summary. The wizard reuses that summary when session and period match. Changing the relevant dates, comparison periods or historical month count still reloads context.
- Saving campaign/date preferences is best effort and does not block moving forward. Current choices continue to travel explicitly with preview/generate requests and receive the same server validation.
- First preview starts immediately; edits to an existing preview are debounced by 300 ms. Superseded requests are aborted, and late responses are ignored. Session recovery waits for the new session state to commit rather than issuing an additional request from stale state.
- Meta Insights date chunks use at most two independent workers, preserving output order. Per-window pagination, attribution, retries, row coverage and adaptive error splitting are unchanged. Failed imports do not return partial rows.
- Each AI action-selection call has an 8-second provider deadline and a shared 12-second budget across fallbacks. Existing factual commentary is still generated when optional providers fail. This is a per-call budget, not a promise that the entire report finishes in 12 seconds.
- Standard report generation loads its template concurrently with commentary, branding and logo I/O.

Validation includes API/AI/report regression suites, fake-time provider stalls, bounded Insights concurrency, period-key changes and a real browser-hook test with held preference responses and out-of-order previews. These are controlled checks, not live production latency measurements. The source data, accuracy checks, generation admission, account connections and browser login cookies are preserved.

The stopped idle preview server was a development-workspace cleanup only. Production behavior changes require deployment; reload the wizard after deployment before the demo. Meta response time, server cold starts, report size and provider availability still affect end-to-end latency.
