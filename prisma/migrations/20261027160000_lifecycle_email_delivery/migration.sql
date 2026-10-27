ALTER TABLE "Report" ADD COLUMN "completedAt" TIMESTAMP(3);
CREATE TABLE "ReportGenerationEvent" ("id" TEXT PRIMARY KEY, "reportId" TEXT NOT NULL, "userId" TEXT NOT NULL, "clientId" TEXT NOT NULL, "platform" TEXT NOT NULL, "reportType" TEXT NOT NULL, "planId" TEXT NOT NULL, "outcome" TEXT NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "legacy" BOOLEAN NOT NULL DEFAULT false);
CREATE UNIQUE INDEX "ReportGenerationEvent_reportId_outcome_key" ON "ReportGenerationEvent"("reportId", "outcome");
CREATE INDEX "ReportGenerationEvent_occurredAt_outcome_idx" ON "ReportGenerationEvent"("occurredAt", "outcome");
-- True historic completion times are unknown. Preserve available records explicitly as legacy estimates.
INSERT INTO "ReportGenerationEvent" ("id", "reportId", "userId", "clientId", "platform", "reportType", "planId", "outcome", "occurredAt", "legacy")
SELECT r."id" || ':COMPLETE', r."id", c."userId", c."id", r."platform"::text, r."reportType"::text, u."planId", 'COMPLETE', r."createdAt", true
FROM "Report" r JOIN "Client" c ON c."id" = r."clientId" JOIN "User" u ON u."id" = c."userId" WHERE r."status" = 'COMPLETE';
UPDATE "Report" SET "completedAt" = "createdAt" WHERE "status" = 'COMPLETE';
CREATE TABLE "EmailDelivery" ("key" TEXT PRIMARY KEY, "kind" TEXT NOT NULL, "userId" TEXT, "payloadJson" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0, "leaseUntil" TIMESTAMP(3), "lastAttemptAt" TIMESTAMP(3), "acceptedAt" TIMESTAMP(3), "providerId" TEXT, "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "EmailDelivery_status_createdAt_idx" ON "EmailDelivery"("status", "createdAt");
