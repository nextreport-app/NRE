-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('WEEKLY', 'MONTHLY');

-- AlterTable: which report the wizard generated (Weekly vs Monthly) — see
-- prisma/schema.prisma's ReportType enum comment for what each drives.
ALTER TABLE "Report" ADD COLUMN "reportType" "ReportType" NOT NULL DEFAULT 'WEEKLY';
