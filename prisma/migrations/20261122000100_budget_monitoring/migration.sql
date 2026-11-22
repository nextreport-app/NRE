ALTER TABLE "Client"
ADD COLUMN "budgetMonitorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "budgetMonitorEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "budgetMonitorSnapshot" TEXT,
ADD COLUMN "budgetMonitorLastAttemptAt" TIMESTAMP(3),
ADD COLUMN "budgetMonitorLeaseUntil" TIMESTAMP(3);
CREATE INDEX "Client_budgetMonitorEnabled_budgetMonitorLastAttemptAt_idx" ON "Client"("budgetMonitorEnabled", "budgetMonitorLastAttemptAt");
