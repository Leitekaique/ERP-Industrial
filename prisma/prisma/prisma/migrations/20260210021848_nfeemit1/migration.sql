-- DropForeignKey
ALTER TABLE "Nfe" DROP CONSTRAINT "Nfe_customerId_fkey";

-- AlterTable
ALTER TABLE "Nfe" ADD COLUMN     "supplierId" TEXT,
ALTER COLUMN "customerId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Nfe_customerId_idx" ON "Nfe"("customerId");

-- CreateIndex
CREATE INDEX "Nfe_supplierId_idx" ON "Nfe"("supplierId");

-- AddForeignKey
ALTER TABLE "Nfe" ADD CONSTRAINT "Nfe_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nfe" ADD CONSTRAINT "Nfe_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
