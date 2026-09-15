import { NextResponse } from "next/server";
import { z } from "zod";
import { processReportGeneration } from "@/lib/nre/report-generation-job";

export const maxDuration = 300;

const bodySchema = z.object({ reportId: z.string().min(1) });

/** Internal worker — processes one GENERATING report by id. Secured with CRON_SECRET. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let reportId: string;
  try {
    const json = await request.json();
    reportId = bodySchema.parse(json).reportId;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  await processReportGeneration(reportId);
  return NextResponse.json({ ok: true, reportId });
}
