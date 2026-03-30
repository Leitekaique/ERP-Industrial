-- CreateTable
CREATE TABLE "NfeEmit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "numeroNF" TEXT NOT NULL,
    "serie" TEXT DEFAULT '1',
    "xmlPath" TEXT,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "destinatario" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "dataEmissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfeEmit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NfeEmit_tenantId_companyId_idx" ON "NfeEmit"("tenantId", "companyId");
