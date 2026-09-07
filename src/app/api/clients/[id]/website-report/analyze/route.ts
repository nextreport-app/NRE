import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fileFromFormData } from "@/lib/http-file";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { detectGa4CsvDimensions, readGa4RowsWithAutoMap } from "@/lib/nre/ga4-columns";
import { parseUploadedFile } from "@/lib/nre/parse-file";
import { validateGa4Csv } from "@/lib/nre/validate-ga4";
import { computeGa4CsvDateBounds } from "@/lib/nre/build-website-report-from-csv";

/** Validates a GA4 CSV and returns detected columns + date bounds for the wizard. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await requireActiveSubscription(session.user.id);
  if (guard) return guard;

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: { userId: true, timezone: true },
  });
  if (!client || client.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const buffer = await fileFromFormData(formData, "ga4Csv");
  if (!buffer) {
    return NextResponse.json({ error: "Upload a GA4 CSV file (field: ga4Csv)." }, { status: 400 });
  }

  try {
    const parsed = parseUploadedFile(buffer, "GA4 CSV");
    const { colMap, rows } = readGa4RowsWithAutoMap(parsed.headers, parsed.dataRows);
    const validation = validateGa4Csv(colMap, rows, new Date(), parsed.headers);
    const dateBounds = computeGa4CsvDateBounds(rows);

    return NextResponse.json({
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      headers: parsed.headers,
      rowCount: rows.length,
      detectedDimensions: detectGa4CsvDimensions(colMap),
      dateBounds,
      hasDateColumn: !!colMap.date,
    });
  } catch (err) {
    console.error("[api:website-report:analyze]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not parse GA4 CSV" },
      { status: 400 },
    );
  }
}
