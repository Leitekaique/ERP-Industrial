-- AlterTable
ALTER TABLE "NfeItem" ADD COLUMN     "sku" TEXT;

-- AlterTable
ALTER TABLE "Transporter" ADD COLUMN     "city" TEXT,
ADD COLUMN     "complement" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "zip" TEXT;

-- CreateIndex
CREATE INDEX "Transporter_tenantId_companyId_idx" ON "Transporter"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "Transporter_cnpj_idx" ON "Transporter"("cnpj");
