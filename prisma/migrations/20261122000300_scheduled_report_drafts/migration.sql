CREATE TABLE "ReportSchedule" (
 "id" TEXT NOT NULL PRIMARY KEY, "clientId" TEXT NOT NULL, "cadence" TEXT NOT NULL,
 "settingsJson" TEXT NOT NULL,"accountId" TEXT NOT NULL,"currency" TEXT NOT NULL,"timezone" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT false,"nextRunAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ReportSchedule_clientId_fkey" FOREIGN KEY("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReportSchedule_clientId_cadence_key" ON "ReportSchedule"("clientId","cadence");
CREATE INDEX "ReportSchedule_enabled_nextRunAt_idx" ON "ReportSchedule"("enabled","nextRunAt");
CREATE TABLE "ScheduledReportRun" (
 "id" TEXT NOT NULL PRIMARY KEY,"scheduleId" TEXT NOT NULL,"dueAt" TIMESTAMP(3) NOT NULL,"settingsJson" TEXT NOT NULL,
 "manual" BOOLEAN NOT NULL DEFAULT false,"verificationJson" TEXT,"status" TEXT NOT NULL DEFAULT 'PENDING',"leaseUntil" TIMESTAMP(3),"attempts" INTEGER NOT NULL DEFAULT 0,
 "error" TEXT,"sourceSessionId" TEXT,"approvalDigest" TEXT,"approvedById" TEXT,"approvedAt" TIMESTAMP(3),"deliveredAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ScheduledReportRun_scheduleId_fkey" FOREIGN KEY("scheduleId") REFERENCES "ReportSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ScheduledReportRun_scheduleId_dueAt_key" ON "ScheduledReportRun"("scheduleId","dueAt");
CREATE INDEX "ScheduledReportRun_status_leaseUntil_idx" ON "ScheduledReportRun"("status","leaseUntil");
CREATE TABLE "ReportSchedulerState" ("id" TEXT NOT NULL PRIMARY KEY,"checkedAt" TIMESTAMP(3) NOT NULL);
ALTER TABLE "Report" ADD COLUMN "requiresApproval" BOOLEAN NOT NULL DEFAULT false,ADD COLUMN "approvedAt" TIMESTAMP(3),ADD COLUMN "scheduleRunId" TEXT;
CREATE UNIQUE INDEX "Report_scheduleRunId_key" ON "Report"("scheduleRunId");
ALTER TABLE "Report" ADD CONSTRAINT "Report_scheduleRunId_fkey" FOREIGN KEY("scheduleRunId") REFERENCES "ScheduledReportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
