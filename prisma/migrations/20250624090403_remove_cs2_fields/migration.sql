/*
  Warnings:

  - You are about to drop the column `condition` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `skinName` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `statTrak` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `weaponType` on the `items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "items" DROP COLUMN "condition",
DROP COLUMN "skinName",
DROP COLUMN "statTrak",
DROP COLUMN "weaponType";
