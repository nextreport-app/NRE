import { fetchMetaAdAccountMetadata } from "../../meta-api";
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: {
    scheduledReportRun: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    report: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    reportSchedule: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    client: { findUnique: vi.fn() },
    user: { update: vi.fn() },
    emailDelivery: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  fetch: vi.fn(),
  build: vi.fn(),
  verify: vi.fn(),
  capacity: vi.fn(),
  dispatch: vi.fn(),
  queue: vi.fn(),
  deliver: vi.fn(),
  health: vi.fn(),
}));
vi.mock("../../prisma", () => ({ prisma: mocks.db }));
vi.mock("../../subscription", () => ({
  getSubscriptionStatus: () => ({ isBlocked: false }),
}));
vi.mock("../health", () => ({ schedulerHealth: mocks.health }));
vi.mock("../../meta-api", () => ({
  ensureFreshMetaAccessToken: vi
    .fn()
    .mockResolvedValue({ accessToken: "fresh" }),
  fetchMetaAdAccountMetadata: vi
    .fn()
    .mockResolvedValue({ currency: "USD", timezone_name: "UTC" }),
}));
vi.mock(
  "../../nre/meta-api-sync/fetch-campaign-period-reach",
  async (original) => ({
    ...(await original<
      typeof import("../../nre/meta-api-sync/fetch-campaign-period-reach")
    >()),
    fetchMetaCampaignPeriodReachMaps: vi
      .fn()
      .mockResolvedValue({ byRangeKey: {} }),
  }),
);
vi.mock("../../meta-token-storage", () => ({
  decryptMetaToken: () => "token",
  encryptMetaToken: () => "encrypted",
}));
vi.mock("../../nre/meta-api-sync", () => ({ fetchMetaReportCsv: mocks.fetch }));
vi.mock("../../nre/report-engine/build-standard-from-wizard", () => ({
  buildStandardReportForWizard: mocks.build,
}));
vi.mock("../../nre/wizard-csv-verification", () => ({
  verifyStandardWizardReportAgainstCsv: mocks.verify,
}));
vi.mock("../../report-capacity", () => ({
  createReportWithinCapacity: mocks.capacity,
}));
vi.mock("../../nre/dispatch-report-generation-job", () => ({
  dispatchReportGenerationJob: mocks.dispatch,
}));
vi.mock("../../nre/wizard-upload-session", () => ({
  saveWizardUploadSession: vi.fn().mockResolvedValue("source"),
  hashUploadBuffer: () => "hash",
}));
vi.mock("../../email-delivery", () => ({
  queueEmail: mocks.queue,
  deliverQueuedEmail: mocks.deliver,
}));
import {
  processScheduledRun,
  approveScheduledDraft,
  sendApprovedDraft,
  skipScheduledDraft,
  createManualDraft,
  saveReportSchedule,
  enqueueDueSchedules,
} from "../service";
import { reportApprovalDigest } from "../approval";
const settings = {
  cadence: "WEEKLY",
  weekday: 1,
  monthDay: 1,
  time: "09:00",
  timezone: "UTC",
  campaignNames: [],
  showBudget: false,
  recipients: ["client@example.com"],
};
const client = {
  id: "client",
  userId: "owner",
  accountName: "Test",
  currency: "USD",
  timezone: "UTC",
  metaAdAccountId: "account",
  user: {
    id: "owner",
    email: "owner@example.com",
    emailVerified: new Date(),
    metaAdsEnabled: true,
    metaAccessToken: "secret",
  },
};
const report = {
  id: "report",
  clientId: "client",
  scheduleRunId: "run",
  requiresApproval: true,
  status: "COMPLETE",
  approvedAt: new Date(),
  summaryJson: "{}",
  filePath: "deck",
  shareToken: "share",
  displayName: "Weekly",
  fileName: "deck.pptx",
};
const run = {
  id: "run",
  scheduleId: "schedule",
  manual: true,
  status: "PENDING",
  attempts: 0,
  dueAt: new Date("2026-11-23T09:00Z"),
  settingsJson: JSON.stringify({
    settings,
    accountId: "account",
    currency: "USD",
    timezone: "UTC",
  }),
  report: null as typeof report | null,
  approvalDigest: null as string | null,
  schedule: {
    id: "schedule",
    enabled: true,
    client,
    settingsJson: JSON.stringify(settings),
    accountId: "account",
    currency: "USD",
    timezone: "UTC",
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation((fn) => fn(mocks.db));
  mocks.db.scheduledReportRun.findUnique.mockImplementation(async () => run);
  mocks.db.scheduledReportRun.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.scheduledReportRun.count.mockResolvedValue(0);
  mocks.db.report.findUnique.mockResolvedValue(null);
  mocks.db.report.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.reportSchedule.findUnique.mockResolvedValue(run.schedule);
  mocks.db.client.findUnique.mockResolvedValue(client);
  mocks.health.mockResolvedValue({ healthy: false });
  mocks.deliver.mockResolvedValue({ accepted: true });
  mocks.capacity.mockResolvedValue(report);
  mocks.fetch.mockResolvedValue({
    rowCount: 1,
    csvText:
      "Campaign name,Reporting starts,Reporting ends,Amount spent (USD),Impressions\nCampaign,2026-10-24,2026-10-24,10,100\nCampaign,2026-11-22,2026-11-22,10,100",
    campaignPeriodReachMaps: {},
  });
  mocks.build.mockResolvedValue({ data: {} });
  mocks.verify.mockReturnValue({ status: "ok" });
});
describe("scheduled draft lifecycle", () => {
  it("requires verified ownership for approval", async () => {
    await expect(
      approveScheduledDraft("run", "intruder", "hash"),
    ).rejects.toMatchObject({ status: 404 });
    expect(mocks.db.report.updateMany).not.toHaveBeenCalled();
  });
  it("rejects a stale reviewed version", async () => {
    mocks.db.scheduledReportRun.findUnique.mockResolvedValue({
      ...run,
      status: "READY",
      report,
    });
    await expect(
      approveScheduledDraft("run", "owner", "stale"),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.db.report.updateMany).not.toHaveBeenCalled();
  });
  it("records approval of the exact reviewed version", async () => {
    mocks.db.scheduledReportRun.findUnique.mockResolvedValue({
      ...run,
      status: "READY",
      report,
    });
    await approveScheduledDraft("run", "owner", reportApprovalDigest(report));
    expect(mocks.db.scheduledReportRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          approvedById: "owner",
        }),
      }),
    );
  });
  it("cannot send before approval", async () => {
    await expect(sendApprovedDraft("run", "owner")).rejects.toMatchObject({
      status: 409,
    });
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it("does not send an accepted run again", async () => {
    mocks.db.scheduledReportRun.findUnique.mockResolvedValue({
      ...run,
      status: "SENT",
      report,
    });
    expect(await sendApprovedDraft("run", "owner")).toEqual({
      accepted: true,
      alreadyAccepted: true,
    });
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it("uses one immutable delivery key and frozen recipients", async () => {
    mocks.db.scheduledReportRun.findUnique.mockResolvedValue({
      ...run,
      status: "SENDING",
      report,
      approvalDigest: reportApprovalDigest(report),
    });
    await sendApprovedDraft("run", "owner");
    await sendApprovedDraft("run", "owner");
    expect(mocks.queue).toHaveBeenCalledTimes(2);
    for (const [args] of mocks.queue.mock.calls) {
      expect(args.key).toBe("scheduled-client:run");
      expect(args.payload.to).toEqual(settings.recipients);
    }
    expect(mocks.db.scheduledReportRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SENT" }),
      }),
    );
  });
  it.each(["SENDING", "SENT", "REVIEW"])(
    "cannot skip delivery in state %s",
    async (status) => {
      mocks.db.scheduledReportRun.findUnique.mockResolvedValue({
        ...run,
        status,
        report,
      });
      await expect(skipScheduledDraft("run", "owner")).rejects.toMatchObject({
        status: 409,
      });
      expect(mocks.db.report.update).not.toHaveBeenCalled();
    },
  );
  it("revokes public approval when skipping a draft", async () => {
    mocks.db.scheduledReportRun.findUnique.mockResolvedValue({
      ...run,
      status: "APPROVED",
      report,
    });
    await skipScheduledDraft("run", "owner");
    expect(mocks.db.report.update).toHaveBeenCalledWith({
      where: { id: "report" },
      data: { approvedAt: null },
    });
  });
  it("prevents duplicate in-progress manual preparations", async () => {
    mocks.db.scheduledReportRun.count.mockResolvedValue(1);
    await expect(createManualDraft("schedule", "owner")).rejects.toMatchObject({
      status: 429,
    });
    expect(mocks.db.scheduledReportRun.create).not.toHaveBeenCalled();
  });
  it("requires scheduler heartbeat before enabling automation", async () => {
    await expect(
      saveReportSchedule("client", "owner", settings, true),
    ).rejects.toMatchObject({ status: 503 });
    expect(mocks.db.reportSchedule.upsert).not.toHaveBeenCalled();
  });
  it("saves paused schedules without an external scheduler", async () => {
    await saveReportSchedule("client", "owner", settings, false);
    expect(mocks.db.reportSchedule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          enabled: false,
          accountId: "account",
        }),
      }),
    );
  });
  it("builds from fresh verified Meta data using the regular capacity gate", async () => {
    await processScheduledRun("run");
    expect(mocks.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "fresh",
        adAccountId: "account",
        requireDirectResultEvidence: true,
        now: run.dueAt,
      }),
    );
    expect(mocks.verify).toHaveBeenCalled();
    expect(mocks.capacity).toHaveBeenCalledWith(
      "owner",
      expect.objectContaining({
        data: expect.objectContaining({
          requiresApproval: true,
          scheduleRunId: "run",
          id: "scheduled_run",
        }),
      }),
    );
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it("fails closed on reconciliation failure", async () => {
    mocks.verify.mockReturnValue({ status: "error" });
    await processScheduledRun("run");
    expect(mocks.capacity).not.toHaveBeenCalled();
    expect(mocks.db.scheduledReportRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });
  it("never turns an empty Meta response into a zero report", async () => {
    mocks.fetch.mockResolvedValue({ rowCount: 0 });
    await processScheduledRun("run");
    expect(mocks.build).not.toHaveBeenCalled();
    expect(mocks.capacity).not.toHaveBeenCalled();
  });
  it("does not refetch or reserve a second credit for an existing job", async () => {
    mocks.db.scheduledReportRun.findUnique.mockResolvedValue({
      ...run,
      report: { ...report, status: "GENERATING" },
    });
    await processScheduledRun("run");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.capacity).not.toHaveBeenCalled();
    expect(mocks.dispatch).toHaveBeenCalledWith("report");
  });
  it("does not restart skipped drafts", async () => {
    mocks.db.scheduledReportRun.findUnique.mockResolvedValue({
      ...run,
      status: "SKIPPED",
      report,
    });
    await processScheduledRun("run");
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.db.scheduledReportRun.updateMany).not.toHaveBeenCalled();
  });
  it("completes workers only through conditional state updates", async () => {
    mocks.db.scheduledReportRun.findUnique.mockResolvedValue({
      ...run,
      status: "GENERATING",
      report,
    });
    await processScheduledRun("run");
    expect(mocks.db.scheduledReportRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["PENDING", "PREPARING", "GENERATING"] },
        }),
        data: expect.objectContaining({ status: "READY" }),
      }),
    );
  });
  it("does not enqueue missed weeks in a burst", async () => {
    mocks.db.reportSchedule.findMany.mockResolvedValue([
      { ...run.schedule, nextRunAt: new Date("2026-11-02T09:00Z") },
    ]);
    await enqueueDueSchedules(new Date("2026-11-24T12:00Z"));
    expect(mocks.db.scheduledReportRun.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.db.scheduledReportRun.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          dueAt: new Date("2026-11-23T09:00Z"),
        }),
      }),
    );
  });
});

it("requests unique reach for the due period rather than today's window", async () => {
  const { fetchMetaCampaignPeriodReachMaps } = await import(
    "../../nre/meta-api-sync/fetch-campaign-period-reach"
  );
  await processScheduledRun("run");
  expect(fetchMetaCampaignPeriodReachMaps).toHaveBeenCalledWith(
    expect.objectContaining({
      ranges: expect.arrayContaining([
        { startIso: "2026-11-16", endIso: "2026-11-22" },
      ]),
    }),
  );
});

it.each(["DAILY", "FORTNIGHTLY"] as const)(
  "prepares %s using the verified daily-table worker and matching source window",
  async (cadence) => {
    const scheduledSettings = {
      ...settings,
      cadence,
      ...(cadence === "FORTNIGHTLY" ? { anchorDate: "2026-11-23" } : {}),
    };
    mocks.db.scheduledReportRun.findUnique.mockResolvedValue({
      ...run,
      settingsJson: JSON.stringify({
        settings: scheduledSettings,
        accountId: "account",
        currency: "USD",
        timezone: "UTC",
      }),
    });
    mocks.fetch.mockResolvedValue({
      rowCount: 1,
      csvText:
        "Campaign name,Day,Amount spent (USD),Results,Result type,Impressions,Clicks (all),Link clicks\nCampaign,2026-11-22,50,5,On-Facebook leads,1000,30,20",
    });
    await processScheduledRun("run");
    expect(mocks.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        sinceIso: cadence === "DAILY" ? "2026-11-22" : "2026-11-09",
        untilIso: "2026-11-22",
      }),
    );
    expect(mocks.build).not.toHaveBeenCalled();
    expect(mocks.capacity).toHaveBeenCalledWith(
      "owner",
      expect.objectContaining({
        data: expect.objectContaining({
          reportType: "DAY_BREAKDOWN",
          requiresApproval: true,
          weekStart: cadence === "DAILY" ? "2026-11-22" : "2026-11-09",
          weekEnd: "2026-11-22",
        }),
      }),
    );
    const created = mocks.capacity.mock.calls[0][1].data;
    const payload = JSON.parse(created.jobPayload);
    expect(payload.kind).toBe("DAY_BREAKDOWN");
    expect(payload.shareToken).toBe(created.shareToken);
    expect(payload.dayBreakdownData.dateRange.endIso).toBe("2026-11-22");
    expect(payload.reportTitle).toContain(
      cadence === "DAILY" ? "Daily" : "Fortnightly",
    );
    expect(mocks.queue).not.toHaveBeenCalled();
  },
);
it("does not reserve a credit when a daily source contains out-of-period rows", async () => {
  mocks.db.scheduledReportRun.findUnique.mockResolvedValue({
    ...run,
    settingsJson: JSON.stringify({
      settings: { ...settings, cadence: "DAILY" },
      accountId: "account",
      currency: "USD",
      timezone: "UTC",
    }),
  });
  await processScheduledRun("run");
  expect(mocks.capacity).not.toHaveBeenCalled();
  expect(mocks.db.scheduledReportRun.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: "FAILED" }),
    }),
  );
});

it("builds a scheduled draft when Meta returns an equivalent timezone alias", async () => {
  vi.mocked(fetchMetaAdAccountMetadata).mockResolvedValueOnce({ id: "act_account", currency: "USD", timezone_name: "Etc/UTC" });
  await processScheduledRun("run");
  expect(mocks.fetch).toHaveBeenCalled();
  expect(mocks.capacity).toHaveBeenCalled();
});
