-- AlterTable
ALTER TABLE "User" DROP COLUMN "googleDriveMode";
ALTER TABLE "User" DROP COLUMN "googleDriveRootFolderId";
ALTER TABLE "User" DROP COLUMN "googleDriveRootFolderName";
ALTER TABLE "User" DROP COLUMN "googleDriveFolderName";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "googleDriveFolderId";
ALTER TABLE "Client" DROP COLUMN "googleDriveFolderName";
ALTER TABLE "Client" ADD COLUMN "lastDriveFolderId" TEXT;
ALTER TABLE "Client" ADD COLUMN "lastDriveFolderName" TEXT;
