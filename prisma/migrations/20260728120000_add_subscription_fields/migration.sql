-- AlterTable: subscription / billing fields (Razorpay) on User
ALTER TABLE "User" ADD COLUMN "planId" TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE "User" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "subscribedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "razorpayCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN "razorpaySubscriptionId" TEXT;

-- Backfill existing users: trial ends 7 days after their ORIGINAL signup
-- date (createdAt), matching the same rule new signups get — not 7 days
-- from whenever this migration happens to run.
UPDATE "User" SET "trialEndsAt" = "createdAt" + INTERVAL '7 days' WHERE "trialEndsAt" IS NULL;

-- Now that every existing row has a value, make the column required and
-- give it a DB-level computed default so every FUTURE row (any insert
-- path — the credentials signup route, the NextAuth Prisma adapter's own
-- user creation on first Google sign-in, a seed script, etc.) gets a
-- correct trial end date automatically, without the application having to
-- remember to set it in more than one place.
ALTER TABLE "User" ALTER COLUMN "trialEndsAt" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "trialEndsAt" SET DEFAULT (now() + interval '7 days');
