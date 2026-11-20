import { NextResponse } from "next/server";
import Papa from "papaparse";
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
    const details = format === "details";
    let rowIndex = 0;
    const body = details
      ? JSON.stringify(
          {
            platform: source.platform,
            importedAt: source.createdAt,
            expiresAt: source.expiresAt,
            importedFileSha256: source.fileHash,
            rowCount: source.rows.length,
            headers: source.headers,
            metaAdAccountId: source.metaAdAccountId ?? null,
            campaignPeriodReachAtImport: source.metaCampaignPeriodReach ?? null,
            reportSelection: source.reportSelection ?? null,
            note: "CSV is reconstructed from the imported rows; its formatting may differ from the original file hash. Reach lookups cover only the listed ranges; additional period lookups can be fetched during report preparation.",
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
                    { fields: source.headers, data: [] },
                    { quotes: true },
                  ) +
                  "\r\n",
              ),
            );
          },
          pull(controller) {
            if (rowIndex >= source.rows.length) {
              controller.close();
              return;
            }
            const rows = source.rows.slice(rowIndex, rowIndex + 100);
            rowIndex += rows.length;
            const csv = Papa.unparse(
              {
                fields: source.headers,
                data: rows.map((row) =>
                  source.headers.map((header) => row._raw?.[header] ?? ""),
                ),
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
