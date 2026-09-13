-- Three light background variants; map legacy LIGHT → LIGHT_CREAM during enum swap.
-- Do NOT assign LIGHT_CREAM on the old enum first — that value does not exist yet (22P02).

CREATE TYPE "ReportTemplate_new" AS ENUM ('DARK', 'LIGHT_CREAM', 'LIGHT_PEARL', 'LIGHT_SAND');

ALTER TABLE "Client" ALTER COLUMN template DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN template TYPE "ReportTemplate_new"
  USING (
    CASE template::text
      WHEN 'LIGHT' THEN 'LIGHT_CREAM'::"ReportTemplate_new"
      ELSE template::text::"ReportTemplate_new"
    END
  );

DROP TYPE "ReportTemplate";
ALTER TYPE "ReportTemplate_new" RENAME TO "ReportTemplate";
ALTER TABLE "Client" ALTER COLUMN template SET DEFAULT 'DARK';
