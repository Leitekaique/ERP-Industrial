-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('open', 'sent', 'paid', 'overdue');

-- AlterTable
ALTER TABLE "Receivable" ADD COLUMN     "billingId" TEXT;

-- CreateTable
CREATE TABLE "Billing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "status" "BillingStatus" NOT NULL DEFAULT 'open',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Billing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Billing_tenantId_companyId_status_idx" ON "Billing"("tenantId", "companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Billing_tenantId_companyId_customerId_month_year_key" ON "Billing"("tenantId", "companyId", "customerId", "month", "year");

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_billingId_fkey" FOREIGN KEY ("billingId") REFERENCES "Billing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Billing" ADD CONSTRAINT "Billing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Billing" ADD CONSTRAINT "Billing_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Billing" ADD CONSTRAINT "Billing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
