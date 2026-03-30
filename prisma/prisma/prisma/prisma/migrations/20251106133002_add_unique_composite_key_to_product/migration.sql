/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,companyId,sku]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Product_tenantId_companyId_sku_idx";

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "unit" SET DEFAULT 'M';

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_companyId_sku_key" ON "Product"("tenantId", "companyId", "sku");
