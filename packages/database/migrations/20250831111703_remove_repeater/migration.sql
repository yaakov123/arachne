/*
  Warnings:

  - You are about to drop the `repeater_metadata` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "repeater_metadata";
PRAGMA foreign_keys=on;
