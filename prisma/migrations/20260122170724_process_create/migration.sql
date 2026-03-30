-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "artigo" TEXT,
    "forro" TEXT,
    "cola" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'M',
    "price" DECIMAL(14,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Process_tenantId_companyId_idx" ON "Process"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "Process_customerId_idx" ON "Process"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Process_tenantId_companyId_customerId_name_key" ON "Process"("tenantId", "companyId", "customerId", "name");

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
