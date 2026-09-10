-- Agency plan: track lifetime client slots (not just active rows).
ALTER TABLE "User" ADD COLUMN "clientsCreatedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "trialEndingEmailSentAt" TIMESTAMP(3);

UPDATE "User" u
SET "clientsCreatedCount" = sub.cnt
FROM (
  SELECT "userId", COUNT(*)::int AS cnt
  FROM "Client"
  GROUP BY "userId"
) sub
WHERE u.id = sub."userId";
