import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCsvText } from "@/lib/nre/parse-csv";
import { validateMtdDailyCsv } from "@/lib/nre/validate";
import { buildReportData } from "@/lib/nre/report-data";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const mtdDailyCsv = typeof body?.mtdDailyCsv === "string" ? body.mtdDailyCsv : "";
  const periodCsv = typeof body?.periodCsv === "string" ? body.periodCsv : "";

  if (!mtdDailyCsv.trim()) {
    return NextResponse.json(
      { valid: false, errors: [{ field: "mtdDailyCsv", message: "MTD Daily CSV is required." }], warnings: [] },
      { status: 200 },
    );
  }

  const mtdParsed = parseCsvText(mtdDailyCsv);
  const validation = validateMtdDailyCsv(mtdParsed.colMap, mtdParsed.rows);

  if (!validation.valid) {
    return NextResponse.json(
      { valid: false, errors: validation.errors, warnings: validation.warnings },
      { status: 200 },
    );
  }

  const periodParsed = periodCsv.trim() ? parseCsvText(periodCsv) : null;

  const data = buildReportData({
    accountName: client.accountName,
    currencySymbol: CURRENCY_SYMBOLS[client.currency],
    timezone: client.timezone,
    monthlyBudget: client.monthlyBudget,
    mtdDailyRows: mtdParsed.rows,
    periodRows: periodParsed?.rows,
  });

  return NextResponse.json({ valid: true, errors: [], warnings: validation.warnings, data });
}
