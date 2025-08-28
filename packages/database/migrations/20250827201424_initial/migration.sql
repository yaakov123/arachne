-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tags" TEXT,
    "settings" TEXT NOT NULL DEFAULT '{"maxTransactions":10000,"retentionDays":30,"hostFilterMode":"blacklist","maxBodySize":10485760}',
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "lastActivity" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'transactionComplete',
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

-- CreateTable
CREATE TABLE "transaction_headers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "headerType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "transaction_headers_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transaction_headers_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transaction_bodies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "bodyType" TEXT NOT NULL,
    "contentType" TEXT,
    "contentEncoding" TEXT,
    "size" INTEGER NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "truncated" BOOLEAN NOT NULL,
    "detectedFormat" TEXT,
    "encoding" TEXT NOT NULL,
    "isCompressed" BOOLEAN NOT NULL DEFAULT false,
    "sample" TEXT NOT NULL,
    CONSTRAINT "transaction_bodies_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transaction_bodies_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "repeater_metadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "originalTransactionId" TEXT,
    "repeatedAt" DATETIME,
    CONSTRAINT "repeater_metadata_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'system',
    "activeProjectId" TEXT,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "hosts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalHits" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "endpoints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hits" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "endpoints_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "hosts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "transactions_projectId_idx" ON "transactions"("projectId");

-- CreateIndex
CREATE INDEX "transactions_timestamp_idx" ON "transactions"("timestamp");

-- CreateIndex
CREATE INDEX "transactions_urlHost_idx" ON "transactions"("urlHost");

-- CreateIndex
CREATE INDEX "transactions_method_idx" ON "transactions"("method");

-- CreateIndex
CREATE INDEX "transactions_statusCode_idx" ON "transactions"("statusCode");

-- CreateIndex
CREATE INDEX "transaction_headers_transactionId_idx" ON "transaction_headers"("transactionId");

-- CreateIndex
CREATE INDEX "transaction_headers_headerType_idx" ON "transaction_headers"("headerType");

-- CreateIndex
CREATE INDEX "transaction_headers_name_idx" ON "transaction_headers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_bodies_transactionId_key" ON "transaction_bodies"("transactionId");

-- CreateIndex
CREATE INDEX "transaction_bodies_transactionId_idx" ON "transaction_bodies"("transactionId");

-- CreateIndex
CREATE INDEX "transaction_bodies_bodyType_idx" ON "transaction_bodies"("bodyType");

-- CreateIndex
CREATE INDEX "transaction_bodies_detectedFormat_idx" ON "transaction_bodies"("detectedFormat");

-- CreateIndex
CREATE UNIQUE INDEX "repeater_metadata_transactionId_key" ON "repeater_metadata"("transactionId");

-- CreateIndex
CREATE INDEX "repeater_metadata_source_idx" ON "repeater_metadata"("source");

-- CreateIndex
CREATE INDEX "repeater_metadata_originalTransactionId_idx" ON "repeater_metadata"("originalTransactionId");

-- CreateIndex
CREATE INDEX "endpoints_hostId_idx" ON "endpoints"("hostId");

-- CreateIndex
CREATE INDEX "endpoints_method_idx" ON "endpoints"("method");

-- CreateIndex
CREATE UNIQUE INDEX "endpoints_hostId_method_path_key" ON "endpoints"("hostId", "method", "path");
