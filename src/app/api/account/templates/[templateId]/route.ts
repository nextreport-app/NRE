import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import {
  approveAgencyTemplate,
  removeAgencyTemplate,
} from "@/lib/agency-templates/service";
import { drainBlobDeletionQueue } from "@/lib/blob-deletion-outbox";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    if (
      body?.reviewed !== true ||
      typeof body?.digest !== "string" ||
      !/^[a-f0-9]{64}$/.test(body.digest)
    )
      return NextResponse.json(
        { error: "Review the generated sample before approving this design." },
        { status: 400 },
      );
    const { templateId } = await params;
    await approveAgencyTemplate(templateId, session.user.id, body.digest);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "templates:approve");
  }
}
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { templateId } = await params;
    const result = await removeAgencyTemplate(templateId, session.user.id);
    after(() => drainBlobDeletionQueue().then(() => {}));
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "templates:remove");
  }
}
