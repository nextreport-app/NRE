-- AlterTable: Previous Month Data, uploaded once per client and reused
-- automatically for every report generated for that client (see
-- Client.previousMonthDataUrl's schema comment).
ALTER TABLE "Client" ADD COLUMN "previousMonthDataUrl" TEXT;
ALTER TABLE "Client" ADD COLUMN "previousMonthDataUpdatedAt" TIMESTAMP(3);
