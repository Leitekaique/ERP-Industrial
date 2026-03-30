-- DropIndex
DROP INDEX "public"."Product_tenantId_companyId_idx";

-- CreateIndex
CREATE INDEX "Product_tenantId_companyId_sku_idx" ON "Product"("tenantId", "companyId", "sku");
