ALTER TABLE "Client" ADD COLUMN "performanceMonitorEnabled" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "performanceMonitorEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
 ADD COLUMN "performanceMonitorSnapshot" TEXT,
 ADD COLUMN "performanceMonitorLastAttemptAt" TIMESTAMP(3),
 ADD COLUMN "performanceMonitorLeaseUntil" TIMESTAMP(3);
CREATE INDEX "Client_performance_scan_idx" ON "Client"("performanceMonitorEnabled","performanceMonitorLastAttemptAt");
