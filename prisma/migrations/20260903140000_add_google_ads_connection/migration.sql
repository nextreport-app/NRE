-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleAdsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleAdsRefreshToken" TEXT,
ADD COLUMN     "googleAdsAccessToken" TEXT,
ADD COLUMN     "googleAdsConnectedEmail" TEXT;
