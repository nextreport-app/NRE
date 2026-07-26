import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { fileFromFormData } from "@/lib/http-file";
import { contentTypeForLogoFormat, detectLogoFormat, isLogoValidationError, processLogoUpload } from "@/lib/logo-processing";
import { deleteLogoFile, readLogoFile, saveAgencyLogo } from "@/lib/storage";

/** Streams the current user's agency logo — same private-store proxy pattern as /api/clients/[id]/logo. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { agencyLogoUrl: true } });
    if (!user?.agencyLogoUrl) return NextResponse.json({ error: "No agency logo set." }, { status: 404 });

    const buffer = await readLogoFile(user.agencyLogoUrl);
    const format = detectLogoFormat(buffer);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": format ? contentTypeForLogoFormat(format) : "application/octet-stream",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "account:agency-logo:get");
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const buffer = formData ? await fileFromFormData(formData, "logo") : null;
  if (!buffer || buffer.length === 0) {
    return NextResponse.json({ error: "No logo file provided." }, { status: 400 });
  }

  const processed = processLogoUpload(buffer);
  if (isLogoValidationError(processed)) {
    return NextResponse.json({ error: processed.error }, { status: 400 });
  }

  try {
    const agencyLogoUrl = await saveAgencyLogo(session.user.id, processed.buffer, processed.format);
    await prisma.user.update({ where: { id: session.user.id }, data: { agencyLogoUrl } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "account:agency-logo:upload");
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { agencyLogoUrl: true } });
    if (user?.agencyLogoUrl) {
      await deleteLogoFile(user.agencyLogoUrl);
      await prisma.user.update({ where: { id: session.user.id }, data: { agencyLogoUrl: null } });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "account:agency-logo:delete");
  }
}
