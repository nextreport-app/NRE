import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseUploadedFile } from "@/lib/nre/parse-file";
import { validateMtdDailyCsv } from "@/lib/nre/validate";
import { extractCampaignNames } from "@/lib/nre/campaigns";
import { computeCsvDateBounds, computeMtdRangeIso, computeWeeklyRangeOptions } from "@/lib/nre/date-range";
import { apiErrorResponse } from "@/lib/api-error";
import { fileFromFormData } from "@/lib/http-file";
import { dateSelectionSchema, deselectedCampaignsSchema, type DateSelection } from "@/lib/validators/report-wizard";

const DEFAULT_DATE_SELECTION: DateSelection = { mode: "last7" };

/**
 * Step 1+2 of the report upload wizard in one round trip: parses and
 * validates the CSV, lists its campaigns, computes the weekly/MTD date
 * options, and returns the client's saved preferences (if any) so the
 * wizard can pre-select the same campaigns/date mode as last time.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const formData = await req.formData().catch(() => null);
    const mtdDailyBuffer = formData ? await fileFromFormData(formData, "mtdDailyCsv") : null;
    if (!mtdDailyBuffer || mtdDailyBuffer.length === 0) {
      return NextResponse.json(
        { valid: false, errors: [{ field: "mtdDailyCsv", message: "MTD Daily CSV is required." }], warnings: [] },
        { status: 200 },
      );
    }

    const mtdParsed = parseUploadedFile(mtdDailyBuffer, "MTD Daily CSV");
    const validation = validateMtdDailyCsv(mtdParsed.colMap, mtdParsed.rows, undefined, mtdParsed.headers);
    if (!validation.valid) {
      return NextResponse.json(
        { valid: false, errors: validation.errors, warnings: validation.warnings },
        { status: 200 },
      );
    }

    const campaigns = extractCampaignNames(mtdParsed.rows);

    let deselected: string[] = [];
    if (client.lastDeselectedCampaigns) {
      const parsed = deselectedCampaignsSchema.safeParse(JSON.parse(client.lastDeselectedCampaigns));
      if (parsed.success) deselected = parsed.data;
    }
    // Select everything except what was explicitly excluded last time — a
    // brand new campaign in this file, never seen before, defaults to
    // selected the same as any other campaign the user never excluded.
    const deselectedSet = new Set(deselected);
    const selectedCampaigns = campaigns.filter((name) => !deselectedSet.has(name));

    let dateSelection: DateSelection = DEFAULT_DATE_SELECTION;
    if (client.lastDateSelection) {
      const parsed = dateSelectionSchema.safeParse(JSON.parse(client.lastDateSelection));
      if (parsed.success) dateSelection = parsed.data;
    }

    const dateBounds = computeCsvDateBounds(mtdParsed.rows);
    const weeklyOptions = computeWeeklyRangeOptions(mtdParsed.rows);
    const mtdRange = computeMtdRangeIso(mtdParsed.rows);

    return NextResponse.json({
      valid: true,
      errors: [],
      warnings: validation.warnings,
      campaigns,
      selectedCampaigns,
      dateBounds,
      weeklyOptions,
      mtdRange,
      dateSelection,
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:analyze");
  }
}
