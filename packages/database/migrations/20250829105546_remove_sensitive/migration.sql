/*
  Warnings:

  - You are about to drop the column `sensitive` on the `transaction_headers` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_transaction_headers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestTransactionId" TEXT,
    "responseTransactionId" TEXT,
    "headerType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "transaction_headers_requestTransactionId_fkey" FOREIGN KEY ("requestTransactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transaction_headers_responseTransactionId_fkey" FOREIGN KEY ("responseTransactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_transaction_headers" ("headerType", "id", "name", "requestTransactionId", "responseTransactionId", "value") SELECT "headerType", "id", "name", "requestTransactionId", "responseTransactionId", "value" FROM "transaction_headers";
DROP TABLE "transaction_headers";
ALTER TABLE "new_transaction_headers" RENAME TO "transaction_headers";
CREATE INDEX "transaction_headers_requestTransactionId_idx" ON "transaction_headers"("requestTransactionId");
CREATE INDEX "transaction_headers_responseTransactionId_idx" ON "transaction_headers"("responseTransactionId");
CREATE INDEX "transaction_headers_headerType_idx" ON "transaction_headers"("headerType");
CREATE INDEX "transaction_headers_name_idx" ON "transaction_headers"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
