-- This schema field previously had no migration; some installations added it manually.
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "emailsSent" INTEGER NOT NULL DEFAULT 0;
