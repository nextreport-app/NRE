import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGa4AccessTokenForUser } from "@/lib/ga4-session";
import { listGa4Properties, fetchGa4PropertyMetadata } from "@/lib/ga4-api";

const linkSchema = z.object({
  propertyId: z.string().trim().regex(/^\d+$/),
  propertyName: z.string().trim().min(1).max(250),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: { userId: true, ga4PropertyId: true, ga4PropertyName: true },
  });
  if (!client || client.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const accessToken = await getGa4AccessTokenForUser(session.user.id, id);
  if (!accessToken) {
    return NextResponse.json({
      linkedPropertyId: client.ga4PropertyId,
      linkedPropertyName: client.ga4PropertyName,
      connected: false,
      properties: [],
    });
  }

  try {
    const properties = await listGa4Properties(accessToken);
    return NextResponse.json({
      linkedPropertyId: client.ga4PropertyId,
      linkedPropertyName: client.ga4PropertyName,
      connected: true,
      properties,
    });
  } catch (err) {
    console.error("[api:clients:ga4-property:get]", err);
    return NextResponse.json(
      { error: "Could not load GA4 properties" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: { userId: true, ga4PropertyId: true },
  });
  if (!client || client.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "propertyId and propertyName are required" },
      { status: 400 },
    );
  }

  const accessToken = await getGa4AccessTokenForUser(session.user.id, id);
  if (!accessToken)
    return NextResponse.json(
      { error: "Reconnect Google Analytics before linking a property." },
      { status: 400 },
    );
  let property;
  try {
    property = await fetchGa4PropertyMetadata(
      accessToken,
      parsed.data.propertyId,
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "This GA4 property is not accessible. Reconnect Analytics or choose another property.",
      },
      { status: 400 },
    );
  }
  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.client.update({
      where: { id },
      data: {
        ga4PropertyId: property.propertyId,
        ga4PropertyName: property.displayName,
      },
      select: { ga4PropertyId: true, ga4PropertyName: true },
    });
    if (client.ga4PropertyId !== property.propertyId)
      await tx.websiteDashboardSnapshot.deleteMany({ where: { clientId: id } });
    return updated;
  });

  return NextResponse.json({
    propertyId: updated.ga4PropertyId,
    propertyName: updated.ga4PropertyName,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: { userId: true, ga4PropertyId: true },
  });
  if (!client || client.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.client.update({
      where: { id },
      data: { ga4PropertyId: null, ga4PropertyName: null },
    });
    await tx.websiteDashboardSnapshot.deleteMany({ where: { clientId: id } });
  });

  return NextResponse.json({ ok: true });
}
