import type { MetaContentPresentation } from "@/lib/nre/meta-report-content/types";
import {
  metaPageTable,
  metaPreviewMetrics,
} from "@/lib/nre/meta-report-content/format";
export function MetaContentReportView({
  content,
  slideClass = "mb-6",
}: {
  content?: MetaContentPresentation;
  slideClass?: string;
}) {
  if (!content) return null;
  return (
    <>
      {content.pages
        .filter((page) => page.visible !== false)
        .map((page) => (
          <section
            key={page.id}
            className={`${slideClass} rounded-xl border border-ink/15 bg-ink/[0.025] p-5 sm:p-8`}
          >
            <h2 className="break-words text-xl font-bold text-ink sm:text-2xl">
              {page.title}
            </h2>
            <p className="mt-2 text-sm text-ink-secondary">
              {page.dateLabel} · {page.objective}
            </p>
            {page.insight && (
              <p className="mt-3 text-sm font-medium text-ink">
                {page.insight}
              </p>
            )}
            {page.kind === "creative-preview" ? (
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div className="flex min-h-48 items-center justify-center rounded-lg border border-ink/10 bg-ink/5 p-3">
                  {content.media[page.rows[0].adId ?? ""] ? (
                    // Report snapshots are bounded embedded JPEGs; no external optimizer request is needed.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={content.media[page.rows[0].adId ?? ""].data}
                      alt={`Creative for ${page.rows[0].name}`}
                      width={content.media[page.rows[0].adId ?? ""].width}
                      height={content.media[page.rows[0].adId ?? ""].height}
                      className="max-h-80 w-auto max-w-full object-contain"
                    />
                  ) : (
                    <p className="text-sm text-ink-secondary">
                      Preview unavailable
                    </p>
                  )}
                </div>
                <div>
                  <p className="mb-3 break-all text-xs text-ink-muted">
                    Ad ID: {page.rows[0].adId} · {page.rows[0].campaign}
                  </p>
                  <dl className="grid grid-cols-2 gap-4">
                    {metaPreviewMetrics(
                      page.rows[0],
                      page,
                      content.currencySymbol,
                    ).map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-lg border border-ink/10 p-3"
                      >
                        <dt className="text-xs font-medium text-ink-secondary">
                          {label}
                        </dt>
                        <dd className="mt-1 text-lg font-semibold text-ink">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[780px] text-sm">
                  <thead>
                    <tr>
                      {metaPageTable(page, content.currencySymbol)[0].map(
                        (header, i) => (
                          <th
                            key={i}
                            className="border-b border-ink/15 bg-ink/5 px-3 py-3 text-left font-semibold text-ink"
                          >
                            {header}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {metaPageTable(page, content.currencySymbol)
                      .slice(1)
                      .map((row, i) => (
                        <tr key={i} className={i % 2 ? "bg-ink/[0.025]" : ""}>
                          {row.map((value, j) => (
                            <td
                              key={j}
                              className="border-b border-ink/10 px-3 py-3 text-ink-secondary"
                            >
                              {value}
                              {j === 1 && (
                                <div
                                  aria-hidden
                                  className="mt-1 h-0.5 rounded bg-sky-400/70"
                                  style={{
                                    width: `${Math.max(0, (page.rows[i].spend / Math.max(...page.rows.map((row) => row.spend), 1)) * 100)}%`,
                                  }}
                                />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!page.rows.length && (
                  <p className="py-5 text-sm text-ink-secondary">
                    No source observations for these campaigns and dates.
                  </p>
                )}
              </div>
            )}
            {page.note && (
              <p className="mt-4 text-xs leading-relaxed text-ink-muted">
                {page.note}
              </p>
            )}
          </section>
        ))}
    </>
  );
}
