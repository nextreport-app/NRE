import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { reminderSettingsSchema } from "@/lib/report-reminders/model";
import {
  ownedReminderClient,
  saveReminder,
  markReminderSent,
} from "@/lib/report-reminders/service";
const bodySchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("save"), settings: reminderSettingsSchema })
    .strict(),
  z.object({ action: z.literal("sent") }).strict(),
  z.object({ action: z.literal("toggle"), enabled: z.boolean() }).strict(),
]);
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success)
      return NextResponse.json(
        { error: body.error.issues[0]?.message ?? "Invalid reminder" },
        { status: 400 },
      );
    if (body.data.action === "save")
      await saveReminder(id, session.user.id, body.data.settings);
    else {
      await ownedReminderClient(id, session.user.id);
      if (body.data.action === "sent")
        await markReminderSent(id, session.user.id);
      else
        await prisma.reportReminder.updateMany({
          where: { clientId: id },
          data: { enabled: body.data.enabled, lastCheckedAt: null },
        });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "report-reminder");
  }
}
