CREATE TABLE "ReportQualityIncident" (
  "id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "signalCodes" TEXT[] NOT NULL,
  "occurrences" INTEGER NOT NULL DEFAULT 1,
  "revision" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportQualityIncident_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReportQualityIncident_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReportQualityIncident_fingerprint_key" ON "ReportQualityIncident"("fingerprint");
CREATE INDEX "ReportQualityIncident_lastSeenAt_idx" ON "ReportQualityIncident"("lastSeenAt");
