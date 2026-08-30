-- Add Daily and Creative report types for Meta reporting workflows.
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'DAILY';
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'CREATIVE';
