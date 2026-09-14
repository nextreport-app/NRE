-- Revert three light variants back to a single LIGHT template.

CREATE TYPE "ReportTemplate_new" AS ENUM ('DARK', 'LIGHT');

ALTER TABLE "Client" ALTER COLUMN template DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN template TYPE "ReportTemplate_new"
  USING (
    CASE template::text
      WHEN 'LIGHT_CREAM' THEN 'LIGHT'::"ReportTemplate_new"
      WHEN 'LIGHT_PEARL' THEN 'LIGHT'::"ReportTemplate_new"
      WHEN 'LIGHT_SAND' THEN 'LIGHT'::"ReportTemplate_new"
      ELSE template::text::"ReportTemplate_new"
    END
  );

DROP TYPE "ReportTemplate";
ALTER TYPE "ReportTemplate_new" RENAME TO "ReportTemplate";
ALTER TABLE "Client" ALTER COLUMN template SET DEFAULT 'DARK';
