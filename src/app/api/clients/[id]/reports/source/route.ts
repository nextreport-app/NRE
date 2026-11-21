import { NextResponse } from "next/server";
import Papa from "papaparse";
import { metaReportSourceExport } from "@/lib/nre/meta-report-content/source-export";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { attachmentContentDisposition } from "@/lib/download-filename";
import { loadWizardUploadSession } from "@/lib/nre/wizard-upload-session";
import { uploadSessionIdSchema } from "@/lib/validators/report-wizard";

/** Owner-only export of the imported snapshot; never queries Meta again. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.userId !== session.user.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const url = new URL(req.url);
    const parsed = uploadSessionIdSchema.safeParse(
      url.searchParams.get("uploadSessionId"),
    );
    const format = url.searchParams.get("format") ?? "csv";
    if (!parsed.success || !["csv", "details"].includes(format))
      return NextResponse.json(
        { error: "Invalid source request." },
        { status: 400 },
      );
    const source = await loadWizardUploadSession(
      session.user.id,
      id,
      parsed.data,
    );
    if (!source)
      return NextResponse.json(
        {
          error:
            "This source snapshot expired. Start a new report and sync again.",
        },
        { status: 410 },
      );
    if (source.userId !== session.user.id || source.clientId !== id)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const reportSource = source.reportSelection
      ? metaReportSourceExport(source.reportSelection, source.metaReportContent) : null;
    if (source.reportSelection && !reportSource)
      return NextResponse.json({ error: "Prepare the selected report in Review & generate, then download its source." }, { status: 409 });
    const headers = reportSource?.headers ?? source.headers;
    const rowCount = reportSource?.rowCount ?? source.rows.length;
    const details = format === "details";
    let rowIndex = 0;
    const body = details
      ? JSON.stringify(
          {
            platform: source.platform,
            importedAt: source.createdAt,
            expiresAt: source.expiresAt,
            importedFileSha256: source.fileHash,
            rowCount,
            headers,
            granularity: reportSource?.granularity ?? "daily",
            coverage: reportSource?.coverage ?? null,
            metaAdAccountId: source.metaAdAccountId ?? null,
            campaignPeriodReachAtImport: source.metaCampaignPeriodReach ?? null,
            reportSelection: source.reportSelection ?? null,
            note: reportSource ? "CSV contains the selected report dataset. Period totals cover exactly the listed dates; they cannot be split into daily values. Unavailable values remain —. The imported file hash refers to the original import, not this reconstructed CSV." : "CSV is reconstructed from the imported rows; its formatting may differ from the original file hash. Reach lookups cover only the listed ranges; additional period lookups can be fetched during report preparation.",
          },
          null,
          2,
        )
      : new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                "\uFEFF" +
                  Papa.unparse(
                    { fields: headers, data: [] },
                    { quotes: true },
                  ) +
                  "\r\n",
              ),
            );
          },
          pull(controller) {
            if (rowIndex >= rowCount) {
              controller.close();
              return;
            }
            const end = Math.min(rowIndex + 100, rowCount);
            const rows = Array.from({ length: end - rowIndex }, (_, offset) => {
              const index = rowIndex + offset;
              return reportSource ? reportSource.row(index) : headers.map(header => source.rows[index]._raw?.[header] ?? "");
            });
            rowIndex = end;
            const csv = Papa.unparse(
              {
                fields: headers,
                data: rows,
              },
              { quotes: true, header: false },
            );
            controller.enqueue(new TextEncoder().encode(csv + "\r\n"));
          },
        });
    const name = details ? "meta-sync-details.json" : "meta-synced-source.csv";
    return new Response(body, {
      headers: {
        "Content-Type": details
          ? "application/json; charset=utf-8"
          : "text/csv; charset=utf-8",
        "Content-Disposition": attachmentContentDisposition(name),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "reports:source");
  }
}
