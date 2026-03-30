/*
  Warnings:

  - You are about to drop the column `freightType` on the `Nfe` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "NfeFreightPayer" AS ENUM ('EMITENTE', 'DESTINATARIO', 'TERCEIROS', 'SEM_FRETE');

-- AlterTable
ALTER TABLE "Nfe" DROP COLUMN "freightType",
ADD COLUMN     "ambiente" TEXT,
ADD COLUMN     "billingDiscount" DECIMAL(14,2),
ADD COLUMN     "billingNet" DECIMAL(14,2),
ADD COLUMN     "billingNumber" TEXT,
ADD COLUMN     "billingOriginal" DECIMAL(14,2),
ADD COLUMN     "destBairro" TEXT,
ADD COLUMN     "destCep" TEXT,
ADD COLUMN     "destCnpjCpf" TEXT,
ADD COLUMN     "destEmail" TEXT,
ADD COLUMN     "destEndereco" TEXT,
ADD COLUMN     "destFone" TEXT,
ADD COLUMN     "destIe" TEXT,
ADD COLUMN     "destMunicipio" TEXT,
ADD COLUMN     "destRazaoSocial" TEXT,
ADD COLUMN     "destUf" TEXT,
ADD COLUMN     "discountValue" DECIMAL(14,2),
ADD COLUMN     "emitBairro" TEXT,
ADD COLUMN     "emitCep" TEXT,
ADD COLUMN     "emitCnpj" TEXT,
ADD COLUMN     "emitEndereco" TEXT,
ADD COLUMN     "emitFone" TEXT,
ADD COLUMN     "emitIe" TEXT,
ADD COLUMN     "emitMunicipio" TEXT,
ADD COLUMN     "emitRazaoSocial" TEXT,
ADD COLUMN     "emitUf" TEXT,
ADD COLUMN     "finalidade" TEXT,
ADD COLUMN     "freightPayer" "NfeFreightPayer",
ADD COLUMN     "freightValue" DECIMAL(14,2),
ADD COLUMN     "insuranceValue" DECIMAL(14,2),
ADD COLUMN     "municipioFatoGerador" TEXT,
ADD COLUMN     "naturezaOperacao" TEXT,
ADD COLUMN     "otherValue" DECIMAL(14,2),
ADD COLUMN     "tipoNf" TEXT,
ADD COLUMN     "totalTribApprox" DECIMAL(14,2),
ADD COLUMN     "ufFatoGerador" TEXT;

-- AlterTable
ALTER TABLE "NfeItem" ADD COLUMN     "itemDiscount" DECIMAL(14,2),
ADD COLUMN     "itemFreight" DECIMAL(14,2),
ADD COLUMN     "itemInsurance" DECIMAL(14,2),
ADD COLUMN     "itemOther" DECIMAL(14,2),
ADD COLUMN     "taxCofinsCst" TEXT,
ADD COLUMN     "taxCsosn" TEXT,
ADD COLUMN     "taxIpiCst" TEXT,
ADD COLUMN     "taxIpiEnq" TEXT DEFAULT '999',
ADD COLUMN     "taxOrig" INTEGER,
ADD COLUMN     "taxPisCst" TEXT,
ADD COLUMN     "taxTotTrib" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "NfeDuplicate" (
    "id" TEXT NOT NULL,
    "nfeId" TEXT NOT NULL,
    "number" TEXT,
    "dueDate" TIMESTAMP(3),
    "value" DECIMAL(14,2),

    CONSTRAINT "NfeDuplicate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfePayment" (
    "id" TEXT NOT NULL,
    "nfeId" TEXT NOT NULL,
    "method" TEXT,
    "value" DECIMAL(14,2),
    "description" TEXT,

    CONSTRAINT "NfePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NfeDuplicate_nfeId_idx" ON "NfeDuplicate"("nfeId");

-- CreateIndex
CREATE INDEX "NfePayment_nfeId_idx" ON "NfePayment"("nfeId");

-- AddForeignKey
ALTER TABLE "NfeDuplicate" ADD CONSTRAINT "NfeDuplicate_nfeId_fkey" FOREIGN KEY ("nfeId") REFERENCES "Nfe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfePayment" ADD CONSTRAINT "NfePayment_nfeId_fkey" FOREIGN KEY ("nfeId") REFERENCES "Nfe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
