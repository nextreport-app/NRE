-- AlterTable
ALTER TABLE "User" ADD COLUMN     "metaAdsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metaAccessToken" TEXT,
ADD COLUMN     "metaTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "metaConnectedUserId" TEXT,
ADD COLUMN     "metaConnectedName" TEXT;
