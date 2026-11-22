ALTER TABLE "Client" ADD COLUMN "performanceWindowDays" INTEGER NOT NULL DEFAULT 7,
 ADD COLUMN "performanceCustomStart" TEXT, ADD COLUMN "performanceCustomEnd" TEXT,
 ADD COLUMN "performanceTargetRules" TEXT;
