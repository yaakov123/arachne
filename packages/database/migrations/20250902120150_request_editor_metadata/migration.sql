-- CreateTable
CREATE TABLE "request_editor_metadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalUrl" TEXT NOT NULL,
    "originalMethod" TEXT NOT NULL,
    "activeRequestTab" TEXT,
    "bodyType" TEXT,
    "userNotes" TEXT,
    "tags" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "duration" INTEGER,
    "requestSize" INTEGER DEFAULT 0,
    "responseSize" INTEGER DEFAULT 0,
    "hasRequestBody" BOOLEAN NOT NULL DEFAULT false,
    "hasResponseBody" BOOLEAN NOT NULL DEFAULT false,
    "metadataType" TEXT,
    "requestBodyId" TEXT,
    "responseBodyId" TEXT,
    "requestEditorMetadataId" TEXT,
    CONSTRAINT "transactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "hosts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_requestBodyId_fkey" FOREIGN KEY ("requestBodyId") REFERENCES "transaction_bodies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_responseBodyId_fkey" FOREIGN KEY ("responseBodyId") REFERENCES "transaction_bodies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_requestEditorMetadataId_fkey" FOREIGN KEY ("requestEditorMetadataId") REFERENCES "request_editor_metadata" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("clientIp", "duration", "hasRequestBody", "hasResponseBody", "hostId", "id", "method", "projectId", "requestBodyId", "requestSize", "responseBodyId", "responseSize", "statusCode", "statusMessage", "timestamp", "urlFragment", "urlFull", "urlHost", "urlPath", "urlPort", "urlProtocol", "urlQuery") SELECT "clientIp", "duration", "hasRequestBody", "hasResponseBody", "hostId", "id", "method", "projectId", "requestBodyId", "requestSize", "responseBodyId", "responseSize", "statusCode", "statusMessage", "timestamp", "urlFragment", "urlFull", "urlHost", "urlPath", "urlPort", "urlProtocol", "urlQuery" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE UNIQUE INDEX "transactions_requestEditorMetadataId_key" ON "transactions"("requestEditorMetadataId");
CREATE INDEX "transactions_projectId_idx" ON "transactions"("projectId");
CREATE INDEX "transactions_hostId_idx" ON "transactions"("hostId");
CREATE INDEX "transactions_timestamp_idx" ON "transactions"("timestamp");
CREATE INDEX "transactions_urlHost_idx" ON "transactions"("urlHost");
CREATE INDEX "transactions_method_idx" ON "transactions"("method");
CREATE INDEX "transactions_statusCode_idx" ON "transactions"("statusCode");
CREATE INDEX "transactions_metadataType_idx" ON "transactions"("metadataType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
