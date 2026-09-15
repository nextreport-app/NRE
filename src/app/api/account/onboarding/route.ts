import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { onboardingDismissedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "account:onboarding-dismiss");
  }
}
