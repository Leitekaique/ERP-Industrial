-- DropIndex
DROP INDEX "Product_tenantId_companyId_sku_key";

-- CreateIndex
CREATE INDEX "Product_tenantId_companyId_sku_idx" ON "Product"("tenantId", "companyId", "sku");
