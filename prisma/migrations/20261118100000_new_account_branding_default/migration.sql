-- New accounts start without a Prepared by credit. Preserve existing users' choices.
ALTER TABLE "User" ALTER COLUMN "reportBrandingMode" SET DEFAULT 'hidden';
ALTER TABLE "User" ALTER COLUMN "showAgencyNameOnCover" SET DEFAULT false;
