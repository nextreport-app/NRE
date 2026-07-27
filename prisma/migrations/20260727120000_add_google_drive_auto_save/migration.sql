-- AlterTable
ALTER TABLE "User" ADD COLUMN "googleDriveEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "googleDriveFolderName" TEXT NOT NULL DEFAULT 'NextReport Reports';
ALTER TABLE "User" ADD COLUMN "googleAccessToken" TEXT;
ALTER TABLE "User" ADD COLUMN "googleRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN "googleConnectedEmail" TEXT;
