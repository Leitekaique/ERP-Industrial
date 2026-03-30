/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,companyId,empresaId,sku,processo]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "NfeEmit" ADD COLUMN     "cnpjTransportadora" TEXT,
ADD COLUMN     "transportadora" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "empresaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_companyId_empresaId_sku_processo_key" ON "Product"("tenantId", "companyId", "empresaId", "sku", "processo");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
