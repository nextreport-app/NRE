-- Replace legacy Claude template enum slots (EMERALD/PURPLE/CRIMSON/GRAPHITE)
-- with six fresh color-variant keys. No separate .pptx assets existed for the
-- old names — they fell back to dark.pptx — so no client rows need remapping
-- beyond the enum rename for any row that happened to use those values.

ALTER TYPE "ReportTemplate" RENAME VALUE 'EMERALD' TO 'OCEAN';
ALTER TYPE "ReportTemplate" RENAME VALUE 'PURPLE' TO 'INDIGO';
ALTER TYPE "ReportTemplate" RENAME VALUE 'CRIMSON' TO 'BURGUNDY';
ALTER TYPE "ReportTemplate" RENAME VALUE 'GRAPHITE' TO 'MOSS';
ALTER TYPE "ReportTemplate" ADD VALUE 'STEEL';
ALTER TYPE "ReportTemplate" ADD VALUE 'COPPER';
