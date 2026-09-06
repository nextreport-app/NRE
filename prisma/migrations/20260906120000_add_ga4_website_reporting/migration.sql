-- GA4 website traffic reporting — Platform enum value, WEBSITE report type, OAuth + property link columns.

ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'GA4';
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'WEBSITE';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ga4Enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ga4RefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ga4AccessToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ga4ConnectedEmail" TEXT;

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "ga4PropertyId" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "ga4PropertyName" TEXT;
