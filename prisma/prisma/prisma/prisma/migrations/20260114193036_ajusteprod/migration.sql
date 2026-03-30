/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,companyId,empresaId,sku]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Product_tenantId_companyId_empresaId_sku_processo_key";

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_companyId_empresaId_sku_key" ON "Product"("tenantId", "companyId", "empresaId", "sku");
