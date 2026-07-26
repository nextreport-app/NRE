import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { fileFromFormData } from "@/lib/http-file";
import { isLogoValidationError, processLogoUpload } from "@/lib/logo-processing";
import { deleteLogoFile, readLogoFile, saveClientLogo } from "@/lib/storage";

async function getOwnedClient(userId: string, id: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== userId) return null;
  return client;
}

/** Streams the client's current logo — proxied server-side since Blob storage here is private-only, never a client-facing URL (see storage.ts). Used as an `<img>` src in the client form's logo preview. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const client = await getOwnedClient(session.user.id, id);
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!client.logoUrl) return NextResponse.json({ error: "No logo set." }, { status: 404 });

    const buffer = await readLogoFile(client.logoUrl);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    return apiErrorResponse(err, "clients:logo:get");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const client = await getOwnedClient(session.user.id, id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("logo");
  const buffer = formData ? await fileFromFormData(formData, "logo") : null;
  if (!buffer || buffer.length === 0 || !(file instanceof File)) {
    return NextResponse.json({ error: "No logo file provided." }, { status: 400 });
  }

  const processed = await processLogoUpload(buffer, file.type);
  if (isLogoValidationError(processed)) {
    return NextResponse.json({ error: processed.error }, { status: 400 });
  }

  try {
    // saveClientLogo writes to a fixed per-client key (addRandomSuffix:
    // false) — a re-upload overwrites the previous logo in place, so
    // there's no separate old-blob delete step needed here.
    const logoUrl = await saveClientLogo(client.id, processed.buffer);
    await prisma.client.update({ where: { id: client.id }, data: { logoUrl } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "clients:logo:upload");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const client = await getOwnedClient(session.user.id, id);
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (client.logoUrl) {
      await deleteLogoFile(client.logoUrl);
      await prisma.client.update({ where: { id: client.id }, data: { logoUrl: null } });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "clients:logo:delete");
  }
}
