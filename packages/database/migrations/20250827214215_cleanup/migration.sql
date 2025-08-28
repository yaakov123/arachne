/*
  Warnings:

  - You are about to drop the column `lastActivity` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `sizeBytes` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `transactionCount` on the `projects` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tags" TEXT,
    "settings" TEXT NOT NULL DEFAULT '{"maxTransactions":10000,"retentionDays":30,"hostFilterMode":"blacklist","maxBodySize":10485760}'
);
INSERT INTO "new_projects" ("createdAt", "description", "id", "name", "settings", "tags", "updatedAt") SELECT "createdAt", "description", "id", "name", "settings", "tags", "updatedAt" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
