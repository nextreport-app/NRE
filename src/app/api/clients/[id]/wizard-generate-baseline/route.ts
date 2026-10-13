import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import {
  parseWizardGenerateBaseline,
  serializeWizardGenerateBaseline,
  wizardGenerateBaselineSchema,
  type WizardGenerateBaseline,
} from "@/lib/nre/wizard-generate-baseline";

async function ownedClient(userId: string, clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.userId !== userId) return null;
  return client;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const client = await ownedClient(session.user.id, id);
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const baseline = parseWizardGenerateBaseline(client.wizardGenerateBaseline);
    return NextResponse.json({ ok: true, baseline });
  } catch (err) {
    return apiErrorResponse(err, "wizard-generate-baseline:get");
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const client = await ownedClient(session.user.id, id);
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    const raw = body?.baseline;
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Invalid baseline payload." }, { status: 400 });
    }

    const parsed = wizardGenerateBaselineSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid baseline shape." }, { status: 400 });
    }

    const baseline: WizardGenerateBaseline = parsed.data;
    await prisma.client.update({
      where: { id },
      data: { wizardGenerateBaseline: serializeWizardGenerateBaseline(baseline) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "wizard-generate-baseline:put");
  }
}
