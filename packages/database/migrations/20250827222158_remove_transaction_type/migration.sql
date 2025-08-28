/*
  Warnings:

  - You are about to drop the column `type` on the `transactions` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL,
    "projectId" TEXT NOT NULL,
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
    CONSTRAINT "transactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("clientIp", "duration", "hasRequestBody", "hasResponseBody", "id", "method", "projectId", "requestSize", "responseSize", "responseTime", "startTime", "statusCode", "statusMessage", "timestamp", "urlFragment", "urlFull", "urlHost", "urlPath", "urlPort", "urlProtocol", "urlQuery") SELECT "clientIp", "duration", "hasRequestBody", "hasResponseBody", "id", "method", "projectId", "requestSize", "responseSize", "responseTime", "startTime", "statusCode", "statusMessage", "timestamp", "urlFragment", "urlFull", "urlHost", "urlPath", "urlPort", "urlProtocol", "urlQuery" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE INDEX "transactions_projectId_idx" ON "transactions"("projectId");
CREATE INDEX "transactions_timestamp_idx" ON "transactions"("timestamp");
CREATE INDEX "transactions_urlHost_idx" ON "transactions"("urlHost");
CREATE INDEX "transactions_method_idx" ON "transactions"("method");
CREATE INDEX "transactions_statusCode_idx" ON "transactions"("statusCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
