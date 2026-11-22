import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { selectClientDesign } from "@/lib/agency-templates/service";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const client = await prisma.client.findFirst({
      where: { id, userId: session.user.id },
      select: { template: true, agencyTemplateId: true },
    });
    if (!client)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const templates = await prisma.agencyTemplate.findMany({
      where: {
        userId: session.user.id,
        status: "READY",
        archivedAt: null,
        approvedAt: { not: null },
      },
      select: { id: true, name: true, baseVariant: true },
    });
    return NextResponse.json(
      { client, templates },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, "templates:client-design");
  }
}
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = z
      .object({
        agencyTemplateId: z.string().min(1).nullable(),
        variant: z.enum(["DARK", "LIGHT"]).optional(),
      })
      .safeParse(await req.json().catch(() => null));
    if (!input.success)
      return NextResponse.json(
        { error: "Choose a report design." },
        { status: 400 },
      );
    const { id } = await params;
    await selectClientDesign(id, session.user.id, input.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "templates:select");
  }
}
