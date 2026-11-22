import JSZip from "jszip";
import { normalizeAgencyTemplate } from "@/lib/agency-templates/normalize";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadTemplateBuffer } from "@/lib/pptx/templates";
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const variant = new URL(req.url).searchParams.get("variant");
  if (variant !== "DARK" && variant !== "LIGHT")
    return NextResponse.json(
      { error: "Choose Dark or Light." },
      { status: 400 },
    );
  return new NextResponse(
    new Uint8Array(
      await normalizeAgencyTemplate(
        await JSZip.loadAsync(await loadTemplateBuffer(variant)),
      ),
    ),
    {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="NextReport-${variant.toLowerCase()}-starter.pptx"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
