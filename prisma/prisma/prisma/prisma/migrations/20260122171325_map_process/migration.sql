/*
  Warnings:

  - You are about to drop the `Process` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Process" DROP CONSTRAINT "Process_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Process" DROP CONSTRAINT "Process_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Process" DROP CONSTRAINT "Process_tenantId_fkey";

-- DropTable
DROP TABLE "Process";

-- CreateTable
CREATE TABLE "process" (
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

    CONSTRAINT "process_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "process_tenantId_companyId_idx" ON "process"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "process_customerId_idx" ON "process"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "process_tenantId_companyId_customerId_name_key" ON "process"("tenantId", "companyId", "customerId", "name");

-- AddForeignKey
ALTER TABLE "process" ADD CONSTRAINT "process_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process" ADD CONSTRAINT "process_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process" ADD CONSTRAINT "process_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
