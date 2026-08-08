-- AlterTable: free-text client notes (Manage page)
ALTER TABLE "Client" ADD COLUMN "notes" TEXT;

-- AlterTable: user-editable report display name (report history lists)
ALTER TABLE "Report" ADD COLUMN "displayName" TEXT;
