ALTER TABLE "User" ADD COLUMN "paidThrough" TIMESTAMP(3), ADD COLUMN "trialReportsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Report" ADD COLUMN "processingStartedAt" TIMESTAMP(3), ADD COLUMN "trialCreditReserved" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "BillingCheckout" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "planId" TEXT NOT NULL, "currency" TEXT NOT NULL, "interval" TEXT NOT NULL, "amount" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "BillingCheckout_userId_createdAt_idx" ON "BillingCheckout"("userId", "createdAt");
CREATE TABLE "BillingPayment" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "checkoutId" TEXT NOT NULL, "paidThrough" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "BillingPayment_userId_idx" ON "BillingPayment"("userId");
CREATE TABLE "UsageBucket" ("key" TEXT PRIMARY KEY, "hits" INTEGER NOT NULL DEFAULT 1, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "UsageBucket_expiresAt_idx" ON "UsageBucket"("expiresAt");
-- Existing paying accounts must be reconciled against Razorpay before expiry enforcement.
-- No fabricated expiry or fresh trial is granted to legacy paid records.
