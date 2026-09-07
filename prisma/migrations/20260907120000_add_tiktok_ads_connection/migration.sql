-- AlterEnum
ALTER TYPE "Platform" ADD VALUE 'TIKTOK';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tiktokAdsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tiktokAccessToken" TEXT,
ADD COLUMN     "tiktokRefreshToken" TEXT,
ADD COLUMN     "tiktokTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "tiktokConnectedName" TEXT,
ADD COLUMN     "tiktokAdvertiserIds" TEXT;
