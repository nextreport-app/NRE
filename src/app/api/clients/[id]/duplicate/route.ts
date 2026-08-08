import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { requireClientCapacity } from "@/lib/subscription-guard";

const duplicateSchema = z.object({
  accountName: z.string().trim().min(1, "Account name is required").max(150),
});

/**
 * Feature 3 — creates a new Client that copies only the source's settings
 * (currency, timezone, monthlyBudget, template) under a name the user
 * confirms/edits in the modal (components/duplicate-client-button.tsx).
 * Deliberately does NOT copy reports, previousMonthData fields, logoUrl,
 * lastDriveFolderId/Name, lastDeselectedCampaigns/AdSets, lastDateSelection,
 * or notes — a
 * duplicate is meant to be a fresh client sharing only the reusable report-
 * generation settings, not the first client's history/state.
 *
 * Goes through the same requireClientCapacity guard as POST /api/clients —
 * duplicating still creates a new client row and counts against the same
 * plan limit.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const source = await prisma.client.findUnique({ where: { id } });
  if (!source || source.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const guardResponse = await requireClientCapacity(session.user.id);
  if (guardResponse) return guardResponse;

  const body = await req.json().catch(() => null);
  const parsed = duplicateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const client = await prisma.client.create({
      data: {
        userId: session.user.id,
        accountName: parsed.data.accountName,
        currency: source.currency,
        timezone: source.timezone,
        monthlyBudget: source.monthlyBudget,
        template: source.template,
      },
    });
    return NextResponse.json({ client }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "clients:duplicate");
  }
}
