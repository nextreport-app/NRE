-- Three light background variants; map legacy LIGHT to warm cream.

UPDATE "Client" SET template = 'LIGHT_CREAM'::"ReportTemplate"
WHERE template = 'LIGHT';

CREATE TYPE "ReportTemplate_new" AS ENUM ('DARK', 'LIGHT_CREAM', 'LIGHT_PEARL', 'LIGHT_SAND');

ALTER TABLE "Client" ALTER COLUMN template DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN template TYPE "ReportTemplate_new"
  USING template::text::"ReportTemplate_new";

DROP TYPE "ReportTemplate";
ALTER TYPE "ReportTemplate_new" RENAME TO "ReportTemplate";
ALTER TABLE "Client" ALTER COLUMN template SET DEFAULT 'DARK';
