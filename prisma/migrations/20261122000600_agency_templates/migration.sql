CREATE TABLE "AgencyTemplate" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL,
 "baseVariant" "ReportTemplate" NOT NULL, "status" TEXT NOT NULL DEFAULT 'UPLOADING',
 "filePath" TEXT NOT NULL, "previewPath" TEXT NOT NULL, "digest" TEXT,
 "approvedAt" TIMESTAMP(3), "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AgencyTemplate_userId_fkey" FOREIGN KEY("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AgencyTemplate_userId_idx" ON "AgencyTemplate"("userId");
ALTER TABLE "Client" ADD COLUMN "agencyTemplateId" TEXT;
ALTER TABLE "Client" ADD CONSTRAINT "Client_agencyTemplateId_fkey" FOREIGN KEY("agencyTemplateId") REFERENCES "AgencyTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD COLUMN "agencyTemplateId" TEXT, ADD COLUMN "renderTemplateVariant" "ReportTemplate";
ALTER TABLE "Report" ADD CONSTRAINT "Report_agencyTemplateId_fkey" FOREIGN KEY("agencyTemplateId") REFERENCES "AgencyTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
