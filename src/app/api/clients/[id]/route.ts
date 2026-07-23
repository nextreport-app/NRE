import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientSchema } from "@/lib/validators/client";
import { apiErrorResponse } from "@/lib/api-error";

async function getOwnedClient(userId: string, id: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== userId) return null;
  return client;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const client = await getOwnedClient(session.user.id, id);
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ client });
  } catch (err) {
    return apiErrorResponse(err, "clients:get");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await getOwnedClient(session.user.id, id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    const parsed = clientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const client = await prisma.client.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ client });
  } catch (err) {
    return apiErrorResponse(err, "clients:update");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await getOwnedClient(session.user.id, id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "clients:delete");
  }
}
