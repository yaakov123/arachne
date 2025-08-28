/*
  Warnings:

  - Added the required column `hostname` to the `hosts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `hosts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hostId` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_hosts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostname" TEXT NOT NULL,
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalHits" INTEGER NOT NULL DEFAULT 0,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "hosts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_hosts" ("firstSeen", "id", "lastSeen", "totalHits") SELECT "firstSeen", "id", "lastSeen", "totalHits" FROM "hosts";
DROP TABLE "hosts";
ALTER TABLE "new_hosts" RENAME TO "hosts";
CREATE INDEX "hosts_projectId_idx" ON "hosts"("projectId");
CREATE UNIQUE INDEX "hosts_projectId_hostname_key" ON "hosts"("projectId", "hostname");
CREATE TABLE "new_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL,
    "projectId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "clientIp" TEXT,
    "urlFull" TEXT NOT NULL,
    "urlProtocol" TEXT NOT NULL,
    "urlHost" TEXT NOT NULL,
    "urlPort" INTEGER,
    "urlPath" TEXT NOT NULL,
    "urlQuery" TEXT,
    "urlFragment" TEXT,
    "statusCode" INTEGER,
    "statusMessage" TEXT,
    "startTime" BIGINT NOT NULL,
    "responseTime" BIGINT,
    "duration" INTEGER,
    "requestSize" INTEGER DEFAULT 0,
    "responseSize" INTEGER DEFAULT 0,
    "hasRequestBody" BOOLEAN NOT NULL DEFAULT false,
    "hasResponseBody" BOOLEAN NOT NULL DEFAULT false,
    "requestBodyId" TEXT,
    "responseBodyId" TEXT,
    CONSTRAINT "transactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "hosts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_requestBodyId_fkey" FOREIGN KEY ("requestBodyId") REFERENCES "transaction_bodies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_responseBodyId_fkey" FOREIGN KEY ("responseBodyId") REFERENCES "transaction_bodies" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("clientIp", "duration", "hasRequestBody", "hasResponseBody", "id", "method", "projectId", "requestBodyId", "requestSize", "responseBodyId", "responseSize", "responseTime", "startTime", "statusCode", "statusMessage", "timestamp", "urlFragment", "urlFull", "urlHost", "urlPath", "urlPort", "urlProtocol", "urlQuery") SELECT "clientIp", "duration", "hasRequestBody", "hasResponseBody", "id", "method", "projectId", "requestBodyId", "requestSize", "responseBodyId", "responseSize", "responseTime", "startTime", "statusCode", "statusMessage", "timestamp", "urlFragment", "urlFull", "urlHost", "urlPath", "urlPort", "urlProtocol", "urlQuery" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE INDEX "transactions_projectId_idx" ON "transactions"("projectId");
CREATE INDEX "transactions_hostId_idx" ON "transactions"("hostId");
CREATE INDEX "transactions_timestamp_idx" ON "transactions"("timestamp");
CREATE INDEX "transactions_urlHost_idx" ON "transactions"("urlHost");
CREATE INDEX "transactions_method_idx" ON "transactions"("method");
CREATE INDEX "transactions_statusCode_idx" ON "transactions"("statusCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
