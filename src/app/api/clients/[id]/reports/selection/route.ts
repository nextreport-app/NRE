import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { dateSelectionSchema, selectedCampaignsSchema } from "@/lib/validators/report-wizard";
import { z } from "zod";

const bodySchema = z.object({
  // The full campaign list from this upload, required alongside
  // selectedCampaigns so the excluded set can be computed — see the schema
  // comment on Client.lastDeselectedCampaigns for why both the full list
  // and the excluded subset (not just the selection itself) get persisted.
  campaigns: z.array(z.string()).optional(),
  selectedCampaigns: selectedCampaignsSchema.optional(),
  dateSelection: dateSelectionSchema.optional(),
});

/**
 * Saves the report upload wizard's campaign/date-range choices onto the
 * client, so the next upload for the same client pre-selects the same
 * campaigns and date mode. Called when the user advances past each of
 * those two steps — not tied to report generation itself.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid selection payload." }, { status: 400 });
    }

    const data: {
      lastDeselectedCampaigns?: string;
      lastDateSelection?: string;
    } = {};
    if (parsed.data.campaigns && parsed.data.selectedCampaigns) {
      const selected = new Set(parsed.data.selectedCampaigns);
      const deselected = parsed.data.campaigns.filter((name) => !selected.has(name));
      data.lastDeselectedCampaigns = JSON.stringify({ campaigns: parsed.data.campaigns, deselected });
    }
    if (parsed.data.dateSelection) {
      data.lastDateSelection = JSON.stringify(parsed.data.dateSelection);
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true });
    }

    await prisma.client.update({ where: { id: client.id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "reports:selection");
  }
}
