-- AlterTable
ALTER TABLE "User" ADD COLUMN "googleDriveMode" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "User" ADD COLUMN "googleDriveRootFolderId" TEXT;
ALTER TABLE "User" ADD COLUMN "googleDriveRootFolderName" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "googleDriveFolderId" TEXT;
ALTER TABLE "Client" ADD COLUMN "googleDriveFolderName" TEXT;
