import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMetaDeletionConfirmationCode, parseMetaSignedRequest } from "@/lib/meta-api";

/**
 * Meta-required data deletion callback URL. Meta POSTs a signed_request when
 * a user removes the app from Facebook Business integrations.
 *
 * Configure in Meta App Dashboard → Settings → Basic → Data Deletion
 * Callback URL: https://nextreport.in/api/meta/data-deletion
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const signedRequest =
    form?.get("signed_request")?.toString() ??
    (await req.json().catch(() => null))?.signed_request ??
    null;

  if (!signedRequest || typeof signedRequest !== "string") {
    return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
  }

  const payload = parseMetaSignedRequest(signedRequest);
  if (!payload) {
    return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
  }

  const confirmationCode = createMetaDeletionConfirmationCode(payload.user_id);

  // Clear Meta tokens for any NextReport user linked to this Meta user id.
  await prisma.user.updateMany({
    where: { metaConnectedUserId: payload.user_id },
    data: {
      metaAdsEnabled: false,
      metaAccessToken: null,
      metaTokenExpiresAt: null,
      metaConnectedUserId: null,
      metaConnectedName: null,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://nextreport.in";
  const statusUrl = `${baseUrl}/data-deletion?code=${encodeURIComponent(confirmationCode)}`;

  return NextResponse.json({
    url: statusUrl,
    confirmation_code: confirmationCode,
  });
}
