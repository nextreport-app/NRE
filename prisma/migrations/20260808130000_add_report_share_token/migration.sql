-- AlterTable: unguessable 12-character token for the public read-only share
-- page at /r/[shareToken] — nullable (existing reports predate this
-- feature) with a UNIQUE constraint (Postgres allows multiple NULLs under a
-- unique index, so this is safe for pre-existing rows).
ALTER TABLE "Report" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Report_shareToken_key" ON "Report"("shareToken");
