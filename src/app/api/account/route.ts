import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accountSettingsSchema } from "@/lib/validators/account";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { agencyName: true, googleDriveEnabled: true, googleConnectedEmail: true },
    });
    return NextResponse.json({
      agencyName: user?.agencyName ?? null,
      googleDriveEnabled: user?.googleDriveEnabled ?? false,
      googleConnectedEmail: user?.googleConnectedEmail ?? null,
    });
  } catch (err) {
    return apiErrorResponse(err, "account:get");
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = accountSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Partial update — a field genuinely absent from the request must be left
  // untouched rather than overwritten with a schema default.
  const data: { agencyName?: string | null } = {};
  if (parsed.data.agencyName !== undefined) data.agencyName = parsed.data.agencyName;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.user.update({ where: { id: session.user.id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "account:update");
  }
}
