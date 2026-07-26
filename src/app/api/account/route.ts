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
      select: { agencyName: true },
    });
    return NextResponse.json({ agencyName: user?.agencyName ?? null });
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

  try {
    await prisma.user.update({ where: { id: session.user.id }, data: { agencyName: parsed.data.agencyName } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "account:update");
  }
}
