ALTER TABLE "ReportQualityIncident"
 ADD COLUMN "clientId" TEXT,
 ADD COLUMN "contextHash" TEXT,
 ADD COLUMN "diagnosticsJson" TEXT,
 ADD COLUMN "state" TEXT NOT NULL DEFAULT 'RECORDED',
 ADD COLUMN "stateUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "issueNumber" INTEGER,
 ADD COLUMN "fixPrNumber" INTEGER,
 ADD COLUMN "deployedRevision" TEXT,
 ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "ReportQualityIncident" ADD CONSTRAINT "ReportQualityIncident_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "ReportRepairAttempt" (
 "runKey" TEXT NOT NULL PRIMARY KEY,
 "incidentId" TEXT,
 "issueNumber" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReportRepairAttempt_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "ReportQualityIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ReportQualityIncident_userId_clientId_contextHash_idx" ON "ReportQualityIncident"("userId","clientId","contextHash");
