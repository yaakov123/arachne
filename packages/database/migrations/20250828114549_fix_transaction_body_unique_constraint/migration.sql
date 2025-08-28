/*
  Warnings:

  - A unique constraint covering the columns `[transactionId,bodyType]` on the table `transaction_bodies` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "transaction_bodies_transactionId_key";

-- CreateIndex
CREATE UNIQUE INDEX "transaction_bodies_transactionId_bodyType_key" ON "transaction_bodies"("transactionId", "bodyType");
