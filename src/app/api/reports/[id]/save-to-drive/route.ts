import { ServiceError } from "@/lib/service-error";
import {
  clientProviderWriteWhere,
  resolveClientUser,
} from "@/lib/client-provider-connections";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readReportFile } from "@/lib/storage";
import { apiErrorResponse } from "@/lib/api-error";
import {
  DEFAULT_DRIVE_FOLDER_NAME,
  saveReportToDriveFolder,
} from "@/lib/google-drive";

export const maxDuration = 300;

const bodySchema = z.object({
  folderId: z.string().trim().min(1),
  // Optional and free-typed — see report-upload-wizard.tsx's "Folder name"
  // field, next to the paste-a-link input. There's no Drive API call to
  // resolve a real name (drive.file scope can't read metadata for a folder
  // this app didn't create, and adding a broader scope for that would
  // require Google's app-verification review) — the user just tells us
  // what to call it.
  folderName: z.string().trim().optional(),
});

const FOLDER_ACCESS_ERROR_MESSAGE =
  "Could not access that folder. Make sure the folder is in your connected Google Drive account and the link is correct.";

/**
 * The download screen's "Save to Google Drive" button: uploads the
 * already-generated report into the folder id the client extracted from a
 * pasted Drive link (see lib/drive-link.ts), converts it to Google Slides,
 * and shares it. Also remembers the folder on the client
 * (Client.lastDriveFolderId/lastDriveFolderName) so the download screen
 * shows "Saving to: [name] — Change" instead of asking for a link again
 * next time a report is saved for this same client.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const report = await prisma.report.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!report || report.client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (report.requiresApproval && !report.approvedAt)
      return NextResponse.json(
        {
          error:
            "Approve this scheduled draft before sharing or exporting to Drive.",
        },
        { status: 409 },
      );
    if (report.status !== "COMPLETE" || !report.filePath) {
      return NextResponse.json(
        { error: "Report is not ready yet." },
        { status: 409 },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paste a Google Drive folder link first." },
        { status: 400 },
      );
    }

    const user = await resolveClientUser(
      await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { googleRefreshToken: true },
      }),
      report.client,
    );
    if (!user?.googleRefreshToken) {
      return NextResponse.json(
        { error: "Google Drive is not connected." },
        { status: 400 },
      );
    }

    const driveRefreshToken = user.googleRefreshToken;
    const run = async (onProgress: (value: number) => void) => {
      const pptxBuffer = await readReportFile(report.filePath!);
      onProgress(20);
      const fileName =
        report.fileName?.replace(/\.pptx$/i, "") || `NextReport - ${report.id}`;

      // The upload attempt itself IS the folder-access check — a bad/deleted/
      // inaccessible folder id surfaces as a thrown error here, mapped to one
      // clear message rather than whatever raw text the Drive API returned.
      let webViewLink: string;
      try {
        ({ webViewLink } = await saveReportToDriveFolder({
          refreshToken: driveRefreshToken,
          folderId: parsed.data.folderId,
          fileName,
          pptxBuffer,
          onProgress,
        }));
      } catch (err) {
        console.error("[api:reports:save-to-drive] folder upload failed:", err);
        return NextResponse.json(
          {
            error: "folder_access_failed",
            message: FOLDER_ACCESS_ERROR_MESSAGE,
          },
          { status: 400 },
        );
      }

      const folderName = parsed.data.folderName || DEFAULT_DRIVE_FOLDER_NAME;
      const saved = await prisma.$transaction(async (tx) => {
        const destination = await tx.client.updateMany({
          where: {
            id: report.client.id,
            userId: session.user.id,
            ...clientProviderWriteWhere(user, "google-drive"),
          },
          data: {
            lastDriveFolderId: parsed.data.folderId,
            lastDriveFolderName: folderName,
          },
        });
        if (!destination.count) return false;
        const updated = await tx.report.updateMany({
          where: {
            id: report.id,
            status: "COMPLETE",
            filePath: report.filePath,
            summaryJson: report.summaryJson,
            ...(report.requiresApproval ? { approvedAt: { not: null } } : {}),
          },
          data: { slidesUrl: webViewLink },
        });
        if (!updated.count)
          throw new ServiceError(
            "The report changed during export. Review and export the current version again.",
            409,
          );
        return true;
      });
      if (!saved)
        return NextResponse.json(
          {
            error:
              "This client's Drive profile changed while saving. Reload and choose a folder for the current profile.",
          },
          { status: 409 },
        );
      return NextResponse.json({ url: webViewLink, folderName });
    };
    if (!req.headers.get("accept")?.includes("application/x-ndjson"))
      return await run(() => {});
    const encoder = new TextEncoder();
    let cancelled = false;
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (value: object) => {
          if (!cancelled)
            controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
        };
        try {
          emit({ progress: 0 });
          const response = await run((progress) => emit({ progress }));
          const result = await response.json();
          emit(response.ok ? { ...result, progress: 100 } : result);
        } catch (error) {
          console.error("[drive:stream] save failed", error);
          emit({
            error:
              error instanceof ServiceError
                ? error.message
                : "Drive save failed. Reload to check the saved report before retrying.",
          });
        } finally {
          if (!cancelled) controller.close();
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:save-to-drive");
  }
}
