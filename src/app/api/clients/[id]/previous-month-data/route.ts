import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { fileEntryFromFormData } from "@/lib/http-file";
import { parseUploadedFile } from "@/lib/nre/parse-file";
import { extractCampaignNames } from "@/lib/nre/campaigns";
import {
  deletePreviousMonthDataFile,
  previousMonthDataFileName,
  savePreviousMonthDataFile,
} from "@/lib/storage";

async function getOwnedClient(userId: string, id: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== userId) return null;
  return client;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const client = await getOwnedClient(session.user.id, id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData ? await fileEntryFromFormData(formData, "file") : null;
  if (!file || file.buffer.length === 0) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  // Light validation only — is this parseable at all (some format we
  // recognise, with at least one data row)? Full column/objective
  // validation happens later, at report-generation time, reusing the same
  // pipeline the MTD Daily CSV goes through — this upload isn't re-parsed
  // and re-validated a second time here.
  const parsed = parseUploadedFile(file.buffer, "Previous Month Data");
  if (parsed.rows.length === 0) {
    return NextResponse.json(
      { error: "Could not read any data from this file. Check that it's a valid CSV or Excel export." },
      { status: 400 },
    );
  }

  // Part 1 — every campaign in the freshly-uploaded file, pre-selected by
  // default (all-checked, matching the campaign checkbox UI's own default).
  // Re-extracted from this same parse rather than a second read, so the
  // saved selection always exactly matches what's actually in the file
  // that was just saved.
  const campaigns = extractCampaignNames(parsed.rows);

  try {
    const previousUrl = client.previousMonthDataUrl;
    const previousMonthDataUrl = await savePreviousMonthDataFile(
      client.id,
      file.buffer,
      file.fileName,
      file.contentType,
    );
    await prisma.client.update({
      where: { id: client.id },
      data: {
        previousMonthDataUrl,
        previousMonthDataUpdatedAt: new Date(),
        previousMonthSelectedCampaigns: JSON.stringify(campaigns),
      },
    });
    // Best-effort cleanup of the old blob — after the DB points at the new
    // one, and only if the key actually changed (a same-named re-upload
    // overwrote it in place already).
    if (previousUrl && previousUrl !== previousMonthDataUrl) {
      await deletePreviousMonthDataFile(previousUrl);
    }
    return NextResponse.json({
      ok: true,
      fileName: previousMonthDataFileName(previousMonthDataUrl),
      campaigns,
      selectedCampaigns: campaigns,
    });
  } catch (err) {
    return apiErrorResponse(err, "clients:previous-month-data:upload");
  }
}

/**
 * Part 1 — updates just the campaign selection for the client's already-
 * uploaded Previous Month Data file (the checkbox list's own onChange), no
 * re-upload involved. `selectedCampaigns` is trusted as sent — the wizard
 * always computes it from the same campaign list the upload response (or
 * the client page's own server-side re-parse) returned, and an over/under
 * inclusive list here only ever affects this client's own Period row, not
 * any shared state.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const client = await getOwnedClient(session.user.id, id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!client.previousMonthDataUrl) {
    return NextResponse.json({ error: "No Previous Month Data file has been uploaded yet." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const selectedCampaigns = Array.isArray(body?.selectedCampaigns)
    ? body.selectedCampaigns.filter((c: unknown): c is string => typeof c === "string")
    : null;
  if (!selectedCampaigns) {
    return NextResponse.json({ error: "selectedCampaigns must be an array of campaign names." }, { status: 400 });
  }

  try {
    await prisma.client.update({
      where: { id: client.id },
      data: { previousMonthSelectedCampaigns: JSON.stringify(selectedCampaigns) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "clients:previous-month-data:update-selection");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const client = await getOwnedClient(session.user.id, id);
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (client.previousMonthDataUrl) {
      await deletePreviousMonthDataFile(client.previousMonthDataUrl);
      await prisma.client.update({
        where: { id: client.id },
        data: { previousMonthDataUrl: null, previousMonthDataUpdatedAt: null, previousMonthSelectedCampaigns: null },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "clients:previous-month-data:delete");
  }
}
