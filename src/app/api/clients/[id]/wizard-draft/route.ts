import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { clearWizardServerDraft } from "@/lib/nre/wizard-server-draft";

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
    if (!(await ownedClient(session.user.id, id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Compatibility for old tabs: never advertise or read unfinished setups.
    return NextResponse.json({ ok: true, draft: null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return apiErrorResponse(err, "wizard-draft:get");
  }
}

export async function PUT(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    if (!(await ownedClient(session.user.id, id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Saving unfinished report setups is no longer available." }, { status: 410 });
  } catch (err) {
    return apiErrorResponse(err, "wizard-draft:put");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    if (!(await ownedClient(session.user.id, id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await clearWizardServerDraft(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "wizard-draft:delete");
  }
}
