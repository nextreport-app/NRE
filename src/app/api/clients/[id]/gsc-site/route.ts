import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { ServiceError } from "@/lib/service-error";
import { listGscSites, gscSiteSchema } from "@/lib/search-console/api";
import {
  gscAccess,
  gscContext,
  gscGrantWhere,
} from "@/lib/search-console/service";
type Context = { params: Promise<{ id: string }> };
export async function GET(_req: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params,
      { client, user } = await gscContext(session.user.id, id);
    const sites = await listGscSites(await gscAccess(user));
    return NextResponse.json(
      { sites, siteUrl: client.gscSiteUrl },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiErrorResponse(e, "gsc:sites");
  }
}
export async function PATCH(req: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params,
      { user } = await gscContext(session.user.id, id);
    const parsed = z
      .object({ siteUrl: gscSiteSchema })
      .strict()
      .safeParse(await req.json().catch(() => null));
    if (!parsed.success)
      throw new ServiceError("Choose a Search Console site.", 400);
    const sites = await listGscSites(await gscAccess(user));
    if (!sites.some((s) => s.siteUrl === parsed.data.siteUrl))
      throw new ServiceError(
        "This Google login cannot access that site. Choose a listed site.",
        403,
      );
    await prisma.$transaction(async (tx) => {
      const saved = await tx.client.updateMany({
        where: { id, ...gscGrantWhere(user, session.user.id) },
        data: { gscSiteUrl: parsed.data.siteUrl },
      });
      if (!saved.count)
        throw new ServiceError(
          "Connection changed. Reload and choose the site again.",
          409,
        );
      await tx.searchConsoleSnapshot.deleteMany({ where: { clientId: id } });
    });
    return NextResponse.json({ siteUrl: parsed.data.siteUrl });
  } catch (e) {
    return apiErrorResponse(e, "gsc:site-save");
  }
}
export async function DELETE(_req: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    await gscContext(session.user.id, id);
    await prisma.$transaction(async (tx) => {
      await tx.client.updateMany({
        where: { id, userId: session.user.id },
        data: { gscSiteUrl: null },
      });
      await tx.searchConsoleSnapshot.deleteMany({ where: { clientId: id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e, "gsc:site-unlink");
  }
}
