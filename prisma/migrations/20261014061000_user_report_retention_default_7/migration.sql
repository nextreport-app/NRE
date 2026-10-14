-- New accounts default to 7-day report retention; existing users keep their saved value.
ALTER TABLE "User" ALTER COLUMN "reportRetentionDays" SET DEFAULT 7;
