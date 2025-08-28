/*
  Warnings:

  - You are about to drop the column `transactionId` on the `transaction_bodies` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_transaction_bodies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bodyType" TEXT NOT NULL,
    "contentType" TEXT,
    "contentEncoding" TEXT,
    "size" INTEGER NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "truncated" BOOLEAN NOT NULL,
    "detectedFormat" TEXT,
    "encoding" TEXT NOT NULL,
    "isCompressed" BOOLEAN NOT NULL DEFAULT false,
    "sample" TEXT NOT NULL
);
INSERT INTO "new_transaction_bodies" ("bodyType", "contentEncoding", "contentType", "detectedFormat", "encoding", "id", "isCompressed", "sample", "sampleSize", "size", "truncated") SELECT "bodyType", "contentEncoding", "contentType", "detectedFormat", "encoding", "id", "isCompressed", "sample", "sampleSize", "size", "truncated" FROM "transaction_bodies";
DROP TABLE "transaction_bodies";
ALTER TABLE "new_transaction_bodies" RENAME TO "transaction_bodies";
CREATE INDEX "transaction_bodies_bodyType_idx" ON "transaction_bodies"("bodyType");
CREATE INDEX "transaction_bodies_detectedFormat_idx" ON "transaction_bodies"("detectedFormat");
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
    "requestBodyId" TEXT,
    "responseBodyId" TEXT,
    CONSTRAINT "transactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_requestBodyId_fkey" FOREIGN KEY ("requestBodyId") REFERENCES "transaction_bodies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_responseBodyId_fkey" FOREIGN KEY ("responseBodyId") REFERENCES "transaction_bodies" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
