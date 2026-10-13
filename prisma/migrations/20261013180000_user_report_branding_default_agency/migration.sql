-- New signups default to agency white-label (share/PDF uses agency name when set; hidden until name is entered).
ALTER TABLE "User" ALTER COLUMN "reportBrandingMode" SET DEFAULT 'agency';
