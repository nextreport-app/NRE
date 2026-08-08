-- AlterTable: per-client campaign selection for Previous Month Data — JSON
-- string[] of campaign names to include from Client.previousMonthDataUrl's
-- own CSV; NULL means "include everything" (see the column's own schema
-- comment).
ALTER TABLE "Client" ADD COLUMN "previousMonthSelectedCampaigns" TEXT;
