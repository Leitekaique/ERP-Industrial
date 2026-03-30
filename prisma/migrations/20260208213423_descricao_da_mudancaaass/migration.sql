/*
  Warnings:

  - Added the required column `empresaId` to the `ProcessHistory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "NfeImport" ADD COLUMN     "modelo" TEXT,
ADD COLUMN     "nfNumber" TEXT,
ADD COLUMN     "serie" TEXT;

-- AlterTable
ALTER TABLE "ProcessHistory" ADD COLUMN     "empresaId" TEXT NOT NULL,
ADD COLUMN     "nfEntrada" TEXT;

-- AddForeignKey
ALTER TABLE "ProcessHistory" ADD CONSTRAINT "ProcessHistory_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessHistory" ADD CONSTRAINT "ProcessHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessHistory" ADD CONSTRAINT "ProcessHistory_processId_fkey" FOREIGN KEY ("processId") REFERENCES "process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessHistory" ADD CONSTRAINT "ProcessHistory_nfSaidaId_fkey" FOREIGN KEY ("nfSaidaId") REFERENCES "Nfe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
