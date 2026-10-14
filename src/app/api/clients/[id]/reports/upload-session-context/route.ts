import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { loadWizardUploadSession } from "@/lib/nre/wizard-upload-session";
import { computeWizardUploadDateContext } from "@/lib/nre/wizard-upload-date-context";
import { uploadSessionIdSchema } from "@/lib/validators/report-wizard";

const bodySchema = z.object({
  uploadSessionId: uploadSessionIdSchema,
});

/**
 * Rehydrate weekly/MTD date options from a cached analyze upload session
 * after a page refresh — the wizard draft stores selections but needs these
 * computed ranges to render Last 7 days and comparison presets.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: clientId } = await params;
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid upload session." }, { status: 400 });
    }

    const payload = await loadWizardUploadSession(session.user.id, clientId, parsed.data.uploadSessionId);
    if (!payload) {
      return NextResponse.json(
        { ok: false, uploadSessionExpired: true, error: "Upload session expired. Re-analyze your CSV to continue." },
        { status: 200 },
      );
    }

    const context = computeWizardUploadDateContext(payload.rows, client.timezone);

    return NextResponse.json({
      ok: true,
      ...context,
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:upload-session-context");
  }
}
