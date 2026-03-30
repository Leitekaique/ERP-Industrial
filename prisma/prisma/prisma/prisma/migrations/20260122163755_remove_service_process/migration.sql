/*
  Warnings:

  - You are about to drop the `service_process` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `service_process_item` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "service_process_item" DROP CONSTRAINT "service_process_item_processId_fkey";

-- DropTable
DROP TABLE "service_process";

-- DropTable
DROP TABLE "service_process_item";
