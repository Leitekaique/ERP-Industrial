/*
  Warnings:

  - You are about to drop the `work_order` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "accountantEmail" TEXT,
ADD COLUMN     "paymentTermDay" INTEGER;

-- DropTable
DROP TABLE "work_order";

-- DropEnum
DROP TYPE "WorkOrderStatus";
