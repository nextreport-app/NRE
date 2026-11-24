ALTER TABLE "Client" ADD COLUMN "hasProviderConnections" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "ClientProviderConnection" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalId" TEXT,
  "credentials" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientProviderConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClientProviderConnection_clientId_provider_key" ON "ClientProviderConnection"("clientId", "provider");
ALTER TABLE "ClientProviderConnection" ADD CONSTRAINT "ClientProviderConnection_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ClientProviderConnection_provider_externalId_idx" ON "ClientProviderConnection"("provider", "externalId");
