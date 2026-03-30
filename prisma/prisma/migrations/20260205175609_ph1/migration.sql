/*
  Warnings:

  - The values [PROCESS_APPLIED,UNIT_CONVERTED,COMPANY_CHANGED,NO_CHARGE,RETURN,CANCELLED] on the enum `ProcessHistoryType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProcessHistoryType_new" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'UNIT_CONVERSION', 'PROCESS_LINKED', 'PRICE_UPDATED', 'PROCESS_UPDATED', 'SUPPLIER_CHANGED', 'CUSTOMER_CHANGED', 'NF_EMITTED', 'NF_CANCELED');
ALTER TABLE "ProcessHistory" ALTER COLUMN "type" TYPE "ProcessHistoryType_new" USING ("type"::text::"ProcessHistoryType_new");
ALTER TYPE "ProcessHistoryType" RENAME TO "ProcessHistoryType_old";
ALTER TYPE "ProcessHistoryType_new" RENAME TO "ProcessHistoryType";
DROP TYPE "public"."ProcessHistoryType_old";
COMMIT;
