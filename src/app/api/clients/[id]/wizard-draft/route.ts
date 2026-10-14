import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import type { WizardDraftSnapshot } from "@/lib/nre/wizard-draft";
import {
  clearWizardServerDraft,
  loadWizardServerDraft,
  parseWizardDraftSnapshot,
  saveWizardServerDraft,
} from "@/lib/nre/wizard-server-draft";

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

    const draft = await loadWizardServerDraft(session.user.id, id);
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    return apiErrorResponse(err, "wizard-draft:get");
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    if (!(await ownedClient(session.user.id, id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const raw = body?.draft;
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Invalid draft payload." }, { status: 400 });
    }

    const draft = parseWizardDraftSnapshot(JSON.stringify(raw)) as WizardDraftSnapshot | null;
    if (!draft) {
      return NextResponse.json({ error: "Invalid draft shape." }, { status: 400 });
    }

    await saveWizardServerDraft(session.user.id, id, draft);
    return NextResponse.json({ ok: true });
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
