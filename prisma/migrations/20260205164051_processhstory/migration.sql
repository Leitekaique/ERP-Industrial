-- CreateEnum
CREATE TYPE "ProcessHistoryType" AS ENUM ('PROCESS_APPLIED', 'UNIT_CONVERTED', 'COMPANY_CHANGED', 'NO_CHARGE', 'RETURN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProcessHistoryStatus" AS ENUM ('APPLIED', 'INVOICED', 'CANCELED', 'REASSIGNED');

-- CreateTable
CREATE TABLE "ProcessHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "processId" TEXT,
    "processSnapshot" JSONB,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6),
    "unit" TEXT,
    "nfEntradaId" TEXT,
    "nfSaidaId" TEXT,
    "type" "ProcessHistoryType" NOT NULL,
    "status" "ProcessHistoryStatus" NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessHistory_tenantId_companyId_idx" ON "ProcessHistory"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "ProcessHistory_productId_idx" ON "ProcessHistory"("productId");

-- CreateIndex
CREATE INDEX "ProcessHistory_processId_idx" ON "ProcessHistory"("processId");

-- CreateIndex
CREATE INDEX "ProcessHistory_nfEntradaId_idx" ON "ProcessHistory"("nfEntradaId");

-- CreateIndex
CREATE INDEX "ProcessHistory_nfSaidaId_idx" ON "ProcessHistory"("nfSaidaId");
