-- AlterTable: per-client Objective Confirmation memory cache (JSON text,
-- keyed by normalized campaign name) so previously-confirmed campaign
-- objectives are remembered across reports.
ALTER TABLE "Client" ADD COLUMN "campaignObjectiveCache" TEXT;
