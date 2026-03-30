/*
  Warnings:

  - The values [NF_EMITTED,NF_CANCELED] on the enum `ProcessHistoryType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProcessHistoryType_new" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'UNIT_CONVERSION', 'PROCESS_LINKED', 'PRICE_UPDATED', 'PROCESS_UPDATED', 'SUPPLIER_CHANGED', 'CUSTOMER_CHANGED', 'NF_EMITIDA', 'NF_CANCELADA', 'PRODUTO_ATUALIZADO', 'PRODUTO_IMPORTADO');
ALTER TABLE "ProcessHistory" ALTER COLUMN "type" TYPE "ProcessHistoryType_new" USING ("type"::text::"ProcessHistoryType_new");
ALTER TYPE "ProcessHistoryType" RENAME TO "ProcessHistoryType_old";
ALTER TYPE "ProcessHistoryType_new" RENAME TO "ProcessHistoryType";
DROP TYPE "public"."ProcessHistoryType_old";
COMMIT;
