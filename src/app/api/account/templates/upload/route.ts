import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { enforceRateLimit } from "@/lib/usage-rate-limit";
import { uploadAgencyTemplate } from "@/lib/agency-templates/upload";
import { MAX_AGENCY_TEMPLATE_BYTES } from "@/lib/agency-templates/validate";
import { drainBlobDeletionQueue } from "@/lib/blob-deletion-outbox";
export const maxDuration = 120;
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const limited = await enforceRateLimit(
      "agency-template-upload",
      session.user.id,
      3,
      60,
    );
    if (limited) return limited;
    if (
      Number(req.headers.get("content-length") ?? 0) >
      MAX_AGENCY_TEMPLATE_BYTES + 10000
    )
      return NextResponse.json(
        { error: "Keep the PowerPoint file under 4 MB." },
        { status: 413 },
      );
    const form = await req.formData(),
      file = form.get("file"),
      name = String(form.get("name") ?? "").trim(),
      variant = form.get("variant");
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith(".pptx") ||
      !name ||
      name.length > 80 ||
      !["DARK", "LIGHT"].includes(String(variant))
    )
      return NextResponse.json(
        {
          error:
            "Add a design name, choose its starter style and upload a .pptx.",
        },
        { status: 400 },
      );
    if (file.size > MAX_AGENCY_TEMPLATE_BYTES)
      return NextResponse.json(
        { error: "Keep the PowerPoint file under 4 MB." },
        { status: 413 },
      );
    const id = await uploadAgencyTemplate(
      session.user.id,
      name,
      variant as "DARK" | "LIGHT",
      Buffer.from(await file.arrayBuffer()),
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    after(() => drainBlobDeletionQueue().then(() => {}));
    return apiErrorResponse(error, "templates:upload");
  }
}
