-- Separate persisted classification for standalone audience reports.
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'BREAKDOWN';
