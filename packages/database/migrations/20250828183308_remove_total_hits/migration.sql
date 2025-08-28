/*
  Warnings:

  - You are about to drop the column `totalHits` on the `hosts` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_hosts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostname" TEXT NOT NULL,
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "hosts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_hosts" ("firstSeen", "hostname", "id", "lastSeen", "projectId") SELECT "firstSeen", "hostname", "id", "lastSeen", "projectId" FROM "hosts";
DROP TABLE "hosts";
ALTER TABLE "new_hosts" RENAME TO "hosts";
CREATE INDEX "hosts_projectId_idx" ON "hosts"("projectId");
CREATE UNIQUE INDEX "hosts_projectId_hostname_key" ON "hosts"("projectId", "hostname");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
