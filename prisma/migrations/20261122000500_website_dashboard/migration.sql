CREATE TABLE "WebsiteDashboardSnapshot" (
 "id" TEXT NOT NULL PRIMARY KEY, "clientId" TEXT NOT NULL, "days" INTEGER NOT NULL,
 "propertyId" TEXT NOT NULL, "connectionKey" TEXT NOT NULL, "dataJson" TEXT, "error" TEXT,
 "checkedAt" TIMESTAMP(3), "lastAttemptAt" TIMESTAMP(3), "leaseUntil" TIMESTAMP(3),
 CONSTRAINT "WebsiteDashboardSnapshot_clientId_fkey" FOREIGN KEY("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WebsiteDashboardSnapshot_clientId_days_key" ON "WebsiteDashboardSnapshot"("clientId","days");
