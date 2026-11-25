ALTER TABLE "User" ADD COLUMN "gscEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "gscRefreshToken" TEXT, ADD COLUMN "gscConnectedEmail" TEXT;
ALTER TABLE "Client" ADD COLUMN "gscSiteUrl" TEXT;
CREATE TABLE "SearchConsoleSnapshot" (
 "id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "days" INTEGER NOT NULL,
 "rangeKey" TEXT NOT NULL, "siteUrl" TEXT NOT NULL, "connectionKey" TEXT NOT NULL,
 "dataJson" TEXT, "error" TEXT, "checkedAt" TIMESTAMP(3), "lastAttemptAt" TIMESTAMP(3), "leaseUntil" TIMESTAMP(3),
 CONSTRAINT "SearchConsoleSnapshot_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "SearchConsoleSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SearchConsoleSnapshot_clientId_days_key" ON "SearchConsoleSnapshot"("clientId", "days");
