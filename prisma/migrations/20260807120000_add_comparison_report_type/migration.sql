-- AlterEnum: adds the Comparison Report feature's report type — see
-- prisma/schema.prisma's ReportType enum comment for what it drives.
ALTER TYPE "ReportType" ADD VALUE 'COMPARISON';
