import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { isValidAutomationWebhookUrl, isValidSlackWebhookUrl } from "@/lib/report-notifications";
import { integrationSettingsSchema } from "@/lib/validators/account";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { slackWebhookUrl: true, automationWebhookUrl: true },
    });
    return NextResponse.json({
      slackWebhookUrl: user?.slackWebhookUrl ?? null,
      automationWebhookUrl: user?.automationWebhookUrl ?? null,
    });
  } catch (err) {
    return apiErrorResponse(err, "account:integrations:get");
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = integrationSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { slackWebhookUrl, automationWebhookUrl } = parsed.data;

  if (slackWebhookUrl && !isValidSlackWebhookUrl(slackWebhookUrl)) {
    return NextResponse.json({ error: "Slack webhook must start with https://hooks.slack.com/" }, { status: 400 });
  }
  if (automationWebhookUrl && !isValidAutomationWebhookUrl(automationWebhookUrl)) {
    return NextResponse.json({ error: "Automation webhook must be a valid HTTPS URL" }, { status: 400 });
  }

  const data: { slackWebhookUrl?: string | null; automationWebhookUrl?: string | null } = {};
  if (slackWebhookUrl !== undefined) data.slackWebhookUrl = slackWebhookUrl;
  if (automationWebhookUrl !== undefined) data.automationWebhookUrl = automationWebhookUrl;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.user.update({ where: { id: session.user.id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "account:integrations:update");
  }
}
