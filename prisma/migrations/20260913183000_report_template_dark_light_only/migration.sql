-- Keep only DARK and LIGHT report templates; map retired color variants to DARK.

UPDATE "Client" SET template = 'DARK'::"ReportTemplate"
WHERE template IN ('OCEAN', 'INDIGO', 'MOSS', 'BURGUNDY', 'STEEL', 'COPPER');

CREATE TYPE "ReportTemplate_new" AS ENUM ('DARK', 'LIGHT');

ALTER TABLE "Client" ALTER COLUMN template DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN template TYPE "ReportTemplate_new"
  USING template::text::"ReportTemplate_new";

DROP TYPE "ReportTemplate";
ALTER TYPE "ReportTemplate_new" RENAME TO "ReportTemplate";
ALTER TABLE "Client" ALTER COLUMN template SET DEFAULT 'DARK';
