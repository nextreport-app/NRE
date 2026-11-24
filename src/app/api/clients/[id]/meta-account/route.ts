import { timezonesEquivalent } from "@/lib/timezone-equivalence";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { ServiceError } from "@/lib/service-error";
import {
  ensureFreshMetaAccessToken,
  fetchMetaAdAccountMetadata,
} from "@/lib/meta-api";
import { decryptMetaToken, encryptMetaToken } from "@/lib/meta-token-storage";
const schema = z
  .object({ accountId: z.string().regex(/^(act_)?\d+$/) })
  .strict();
/** Explicitly assign a readable ad account to an unassigned client, without importing a report. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.userId !== session.user.id)
      throw new ServiceError("Not found", 404);
    const input = schema.safeParse(await req.json().catch(() => null));
    if (!input.success)
      throw new ServiceError("Choose a valid Meta ad account.");
    const accountId = input.data.accountId.replace(/^act_/, "");
    if (
      client.metaAdAccountId &&
      client.metaAdAccountId.replace(/^act_/, "") !== accountId
    )
      throw new ServiceError(
        "This client already has a different ad account assigned. Refresh the page to view it.",
        409,
      );
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        metaAdsEnabled: true,
        metaAccessToken: true,
        metaTokenExpiresAt: true,
      },
    });
    if (!user?.metaAdsEnabled || !user.metaAccessToken)
      throw new ServiceError("Connect Meta in Account settings first.", 400);
    const token = await ensureFreshMetaAccessToken({
      accessToken: decryptMetaToken(user.metaAccessToken),
      tokenExpiresAt: user.metaTokenExpiresAt,
    });
    if (token.refreshed)
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          metaAccessToken: encryptMetaToken(token.accessToken),
          metaTokenExpiresAt: token.tokenExpiresAt,
        },
      });
    let account;
    try {
      account = await fetchMetaAdAccountMetadata(token.accessToken, accountId);
    } catch {
      throw new ServiceError(
        "Meta could not verify access to this ad account. Reconnect Meta or choose another account.",
        403,
      );
    }
    if (account.id.replace(/^act_/, "") !== accountId)
      throw new ServiceError(
        "Meta returned a different account. Please choose again.",
        400,
      );
    if (
      account.currency !== client.currency ||
      !timezonesEquivalent(account.timezone_name, client.timezone)
    )
      throw new ServiceError(
        `The selected ad account uses ${account.currency} · ${account.timezone_name}; this client is set to ${client.currency} · ${client.timezone}. Update the differing setting in Client settings, then try again.`,
        409,
      );
    if (client.metaAdAccountId) return NextResponse.json({ ok: true });
    const saved = await prisma.client.updateMany({
      where: {
        id,
        userId: session.user.id,
        metaAdAccountId: null,
        currency: client.currency,
        timezone: client.timezone,
      },
      data: {
        metaAdAccountId: accountId,
        metaAdAccountName: account.name || accountId,
      },
    });
    if (!saved.count)
      throw new ServiceError(
        "The client changed while saving. Refresh the page and try again.",
        409,
      );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "clients:meta-account");
  }
}
