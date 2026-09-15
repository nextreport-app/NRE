-- Per-account report retention window (days until auto-purge).
ALTER TABLE "User" ADD COLUMN "reportRetentionDays" INTEGER NOT NULL DEFAULT 30;
