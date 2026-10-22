-- New accounts default to NextReport on shared links until they opt into white-label.
ALTER TABLE "User" ALTER COLUMN "reportBrandingMode" SET DEFAULT 'nextreport';
