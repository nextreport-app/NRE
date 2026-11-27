ALTER TABLE "Client" ADD COLUMN "lastReportSentAt" TIMESTAMP(3);
CREATE TABLE "ReportReminder" (
 "clientId" TEXT NOT NULL PRIMARY KEY,
 "enabled" BOOLEAN NOT NULL DEFAULT true,
 "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
 "cadence" TEXT NOT NULL, "intervalDays" INTEGER NOT NULL DEFAULT 7,
 "monthDay" INTEGER NOT NULL DEFAULT 1, "time" TEXT NOT NULL DEFAULT '09:00',
 "timezone" TEXT NOT NULL, "leadDays" INTEGER NOT NULL DEFAULT 2,
 "nextDueAt" TIMESTAMP(3) NOT NULL, "cycleToken" TEXT NOT NULL,
 "configuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastCompletedAt" TIMESTAMP(3), "lastCheckedAt" TIMESTAMP(3),
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ReportReminder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ReportReminder_interval_check" CHECK ("intervalDays" BETWEEN 1 AND 365 AND "monthDay" BETWEEN 1 AND 31 AND "leadDays" BETWEEN 0 AND 14),
 CONSTRAINT "ReportReminder_cadence_check" CHECK ("cadence" IN ('WEEKLY','FORTNIGHTLY','MONTHLY','CUSTOM'))
);
CREATE INDEX "ReportReminder_enabled_emailEnabled_lastCheckedAt_idx" ON "ReportReminder"("enabled", "emailEnabled", "lastCheckedAt");
