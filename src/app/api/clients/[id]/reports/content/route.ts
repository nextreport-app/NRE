import { timezonesEquivalent } from "@/lib/timezone-equivalence";
import {metaReportOptions} from "@/lib/nre/meta-report-content/selection";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { enforceWizardLimits } from "@/lib/usage-rate-limit";
import {
  loadWizardUploadSession,
  saveWizardUploadSession,
  hashUploadBuffer,
} from "@/lib/nre/wizard-upload-session";
import {
  uploadSessionIdSchema,
  dateSelectionSchema,
} from "@/lib/validators/report-wizard";
import { parseUploadedFile } from "@/lib/nre/parse-file";
import { fileEntriesFromFormData } from "@/lib/http-file";
import {
  parseMetaContentSource,
  buildMetaContentPresentation,
  metaContentSummary,
} from "@/lib/nre/meta-report-content/data";
import { metaContentRanges } from "@/lib/nre/meta-report-content/range";
import {
  fetchMetaContentSources,
  fetchCreativeSnapshots,
  snapshotCreativeImage,
} from "@/lib/nre/meta-report-content/api";
import {
  ensureFreshMetaAccessToken,
  fetchMetaAdAccountMetadata,
} from "@/lib/meta-api";
import { decryptMetaToken, encryptMetaToken } from "@/lib/meta-token-storage";
import { apiQueryCoverage } from "@/lib/nre/api-query-coverage";
import { detectCsvCurrency } from "@/lib/nre/csv-currency";
import type { MetaReportContent } from "@/lib/nre/meta-report-content/types";
export const maxDuration = 300;
const optionsSchema = z.object({
  locationLevel: z.enum(["region", "country"]).optional(),
  audience: z
    .array(z.enum(["age", "location", "platform", "placement"]))
    .max(4)
    .refine(
      (values) => new Set(values).size === values.length,
      "Choose each breakdown once.",
    ),
  creatives: z.boolean(),
  includeStandard: z.boolean(),
  ranking: z.enum(["cpr", "roas", "ctr", "spend"]),
  minSpend: z.number().min(0).max(1e9),
  minResults: z.number().int().min(0).max(1e6),
  selectedAdIds: z.array(z.string().max(100)).max(10000).optional(),
});
const requestSchema = z.object({
  selectedCampaigns: z.array(z.string().max(500)).max(10000).optional(),
  uploadSessionId: uploadSessionIdSchema,
  source: z.enum(["api", "csv"]),
  options: optionsSchema,
  reportType: z.enum(["WEEKLY", "MONTHLY", "HISTORICAL"]),
  dateSelection: dateSelectionSchema.optional(),
  historicalMonthCount: z.number().int().min(1).max(12).optional(),
  reuse: z.boolean().optional(),
});
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const uploadId = uploadSessionIdSchema.safeParse(
    new URL(req.url).searchParams.get("uploadSessionId"),
  );
  if (!uploadId.success)
    return NextResponse.json(
      { error: "Invalid upload session." },
      { status: 400 },
    );
  try {
    const upload = await loadWizardUploadSession(
      session.user.id,
      id,
      uploadId.data,
    );
    if (!upload)
      return NextResponse.json(
        {
          error:
            "Your import expired. Return to Import and sync or upload again.",
        },
        { status: 404 },
      );
    return NextResponse.json(
      { content: metaContentSummary(upload.metaReportContent) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Upload session not found." },
      { status: 404 },
    );
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await requireActiveSubscription(session.user.id);
  if (access) return access;
  const throttle = await enforceWizardLimits(session.user.id, "upload");
  if (throttle) return throttle;
  try {
    if (Number(req.headers.get("content-length")) > 4 * 1024 * 1024)
      throw Error(
        "Keep the total CSV/image upload below 4MB. Use a shorter reporting period if needed.",
      );
    const form = await req.formData();
    const parsed = requestSchema.safeParse(
      JSON.parse(String(form.get("settings") ?? "{}")),
    );
    if (!parsed.success)
      throw Error("Choose valid audience/creative settings.");
    const settings = parsed.data;
    const totalBytes = [...form.values()].reduce(
      (n, value) => n + (typeof value === "string" ? value.length : value.size),
      0,
    );
    if (totalBytes > 4 * 1024 * 1024)
      throw Error("Keep the combined upload below 4MB.");
    const upload = await loadWizardUploadSession(
      session.user.id,
      id,
      settings.uploadSessionId,
    );
    if (!upload || upload.platform !== "META")
      throw Error(
        "Your Meta import expired. Return to Import and sync or upload again.",
      );
    if(upload.reportSelection){
      const expected=metaReportOptions(upload.reportSelection);
      if(settings.options.includeStandard||JSON.stringify(settings.options.audience)!==JSON.stringify(expected.audience)||settings.options.creatives!==expected.creatives||(settings.options.locationLevel??"region")!==(expected.locationLevel??"region"))throw Error("The report choice changed. Return to Import to choose a different report.");
    }
    const ranges = metaContentRanges({
      ...settings,
      reportSelection:upload.reportSelection,
      rows: upload.rows,
      timezone: client.timezone,
    });
    const range = {
      startIso: ranges[0].startIso,
      endIso: ranges.at(-1)!.endIso,
    };
    if (
      upload.metaReportContent?.sourceOnly &&
      settings.options.includeStandard
    )
      throw Error(
        "This is an audience-only import. Start with a standard daily CSV to include standard performance slides.",
      );
    const currency =
      detectCsvCurrency(upload.headers, upload.rows).code ?? client.currency;
    let content: MetaReportContent | undefined;
    if (settings.options.audience.length || settings.options.creatives) {
      content = {
        version: 1,
        sourceOnly: !!upload.reportSelection || upload.metaReportContent?.sourceOnly,
        selection: upload.reportSelection ?? upload.metaReportContent?.selection,
        options: settings.options,
        sources: [],
        media: {},
        notices: [],
        campaigns: settings.selectedCampaigns,
      };
      if (settings.reuse) {
        if (!upload.metaReportContent)
          throw Error("Add or fetch the report sections first.");
        const previous = upload.metaReportContent;
        if (previous.sources.some((source) => source.source === "api")) {
          const requested = settings.selectedCampaigns ?? [
            ...new Set(upload.rows.map((row) => row.campaign_name ?? "")),
          ];
          if (
            previous.campaigns &&
            requested.some(
              (name) =>
                !previous.campaigns!.some(
                  (loaded) =>
                    loaded.trim().toLowerCase() === name.trim().toLowerCase(),
                ),
            )
          )
            throw Error(
              "Campaign selection changed. Refresh these sections from Meta.",
            );
          if (
            settings.options.audience.includes("location") &&
            (settings.options.locationLevel ?? "region") !==
              (previous.options.locationLevel ?? "region")
          )
            throw Error(
              "Location detail changed. Refresh these sections from Meta.",
            );
        }
        content = {
          ...upload.metaReportContent,
          options: settings.options,
          media: { ...upload.metaReportContent.media },
          campaigns: settings.selectedCampaigns,
        };
      } else if (settings.source === "api") {
        if (!upload.metaAdAccountId || !apiQueryCoverage(upload.rows))
          throw Error(
            "Sync Meta on Import before fetching audience or creative data.",
          );
        const coverage=apiQueryCoverage(upload.rows)!;
        if(ranges.some(range=>range.startIso<coverage.startIso||range.endIso>coverage.endIso))throw Error("Your API import does not cover these dates. Return to Import and sync the selected period again.");
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
        });
        if (!user?.metaAccessToken)
          throw Error("Reconnect Meta Ads in Account settings.");
        const fresh = await ensureFreshMetaAccessToken({
          accessToken: decryptMetaToken(user.metaAccessToken),
          tokenExpiresAt: user.metaTokenExpiresAt,
        });
        if (fresh.refreshed)
          await prisma.user.update({
            where: { id: user.id },
            data: {
              metaAccessToken: encryptMetaToken(fresh.accessToken),
              metaTokenExpiresAt: fresh.tokenExpiresAt,
            },
          });
        const account = await fetchMetaAdAccountMetadata(
          fresh.accessToken,
          upload.metaAdAccountId,
        );
        if (
          account.currency !== currency ||
          !timezonesEquivalent(account.timezone_name, client.timezone)
        )
          throw Error(
            "The ad account currency or timezone changed. Return to Import and sync again.",
          );
        content.sources = await fetchMetaContentSources({
          token: fresh.accessToken,
          account: upload.metaAdAccountId,
          currency,
          range,
          periodTotals: !!upload.reportSelection,
          options: settings.options,
          primaryRows: upload.rows.filter(
            (row) =>
              !settings.selectedCampaigns ||
              settings.selectedCampaigns.includes(row.campaign_name ?? ""),
          ),
        });
        if (content.sources.some(source => source.rows.some(row => row.results === null)))
          content.notices.push("Meta did not return complete results for some rows. Affected results and costs show —. Use a matching CSV if you need those figures.");
        const ads =
          content.sources.find((s) => s.kind === "creative")?.rows ?? [];
        const spend = new Map<string, number>();
        ads.forEach((row) => {
          if (row.adId)
            spend.set(row.adId, (spend.get(row.adId) ?? 0) + row.spend);
        });
        const ids = [...spend]
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => id)
          .filter(
            (id) =>
              !settings.options.selectedAdIds ||
              settings.options.selectedAdIds.includes(id),
          );
        const snapshots = await fetchCreativeSnapshots(fresh.accessToken, ids);
        content.media = snapshots.media;
        if (snapshots.missing)
          content.notices.push(
            `${snapshots.missing} creative preview(s) could not be loaded. Their metrics remain available.`,
          );
        if (ids.length > 12)
          content.notices.push(
            "Images were fetched for up to 12 leading ads. All selected ads remain in the performance tables.",
          );
      } else {
        const files = await fileEntriesFromFormData(form, "files");
        if (
          files.length > 6 ||
          files.reduce((n, f) => n + f.buffer.length, 0) > 4 * 1024 * 1024
        )
          throw Error("Use at most six exports, totalling less than 4MB.");
        const incoming = files.map((file) =>
          parseMetaContentSource(
            parseUploadedFile(file.buffer, file.fileName),
            currency,
          ),
        );
        content.sources = [
          ...(upload.metaReportContent?.sources ?? []).filter(
            (old) =>
              !incoming.some(
                (next) =>
                  next.kind === old.kind ||
                  (next.kind === "platform-placement" &&
                    ["platform", "placement"].includes(old.kind)) ||
                  (old.kind === "platform-placement" &&
                    ["platform", "placement"].includes(next.kind)),
              ),
          ),
          ...incoming,
        ];
        content.media = { ...upload.metaReportContent?.media };
        if (
          settings.options.creatives &&
          !content.sources.some((s) => s.kind === "creative")
        )
          content.sources.push(
            parseMetaContentSource(
              { rows: upload.rows, headers: upload.headers },
              currency,
            ),
          );
        if (content.sources.filter((s) => s.kind === "creative").length > 1)
          throw Error("Keep one Ads CSV for creative performance.");
      }
      const primaryIds = new Map(
        upload.rows.flatMap((row) => {
          const key = Object.keys(row._raw).find((k) =>
            /^campaign[ _]id$/i.test(k),
          );
          return key && row._raw[key]
            ? [[row._raw[key], row.campaign_name] as const]
            : [];
        }),
      );
      const primaryNames = new Set(
        upload.rows.map((row) =>
          (row.campaign_name ?? "").trim().toLowerCase(),
        ),
      );
      for (const source of content.sources)
        for (const row of source.rows) {
          if (
            row.campaignId &&
            primaryIds.size &&
            !primaryIds.has(row.campaignId)
          )
            throw Error(
              "Campaign IDs in a section do not match the primary import. Use exports from the same account.",
            );
          if (row.campaignId && primaryIds.has(row.campaignId))
            row.campaign = primaryIds.get(row.campaignId)!;
          else if (!primaryNames.has(row.campaign.trim().toLowerCase()))
            throw Error(
              "A section contains campaigns outside the primary import. Use exports from the same ad account and campaign selection.",
            );
        }
      const attributions = new Set(
        content.sources.flatMap((s) =>
          s.rows.map((r) => r.attribution).filter(Boolean),
        ),
      );
      if (attributions.size > 1)
        throw Error(
          "Use the same attribution setting across the section exports.",
        );
      const knownAds = new Set(
        content.sources
          .filter((s) => s.kind === "creative")
          .flatMap((s) => s.rows.map((r) => r.adId!)),
      );
      if (
        settings.options.creatives &&
        settings.options.selectedAdIds &&
        (settings.options.selectedAdIds.some((id) => !knownAds.has(id)) ||
          (knownAds.size > 0 && settings.options.selectedAdIds.length === 0))
      )
        throw Error(
          "Select at least one known ad, or turn off Creative performance.",
        );
      for (const [field, value] of form.entries())
        if (field.startsWith("media:") && typeof value !== "string") {
          const adId = field.slice(6);
          if (value.size > 2 * 1024 * 1024)
            throw Error("Use images below 2MB.");
          if (!knownAds.has(adId))
            throw Error(
              "Choose an Ad ID from this import before attaching an image.",
            );
          content.media[adId] = await snapshotCreativeImage(
            Buffer.from(await value.arrayBuffer()),
          );
        }
      if (
        Object.keys(content.media).length > 24 ||
        JSON.stringify(content.media).length > 750000
      )
        throw Error("Use up to 24 small creative previews per report.");
      // Validate every source and selection before persisting an immutable session.
      buildMetaContentPresentation(content, ranges, null, "$");
    } else if (!settings.options.includeStandard)
      throw Error(
        "Include standard performance or an audience/creative section.",
      );
    const fileHash = hashUploadBuffer(
      Buffer.from(JSON.stringify({ primary: upload.fileHash, content })),
    );
    const uploadSessionId = await saveWizardUploadSession({
      ...upload,
      fileHash,
      metaReportContent: content,
    });
    return NextResponse.json({
      uploadSessionId,
      content: metaContentSummary(content),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not prepare these report sections. Retry or check the selected exports.",
      },
      { status: 400 },
    );
  }
}
