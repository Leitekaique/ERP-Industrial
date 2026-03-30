-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('CPF', 'CNPJ');

-- CreateEnum
CREATE TYPE "NfeStatus" AS ENUM ('draft', 'sending', 'authorized', 'denied', 'canceled', 'error');

-- CreateEnum
CREATE TYPE "NfeEventType" AS ENUM ('cancel', 'cce', 'inutilization');

-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('open', 'partial', 'paid', 'canceled');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('pix', 'card', 'billet', 'transfer', 'cash');

-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('open', 'partial', 'paid', 'canceled');

-- CreateEnum
CREATE TYPE "ProductOwnerType" AS ENUM ('company', 'customer');

-- CreateEnum
CREATE TYPE "StockOwnership" AS ENUM ('own', 'third_party_in', 'third_party_out');

-- CreateEnum
CREATE TYPE "StockMoveType" AS ENUM ('in', 'out', 'transfer');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('open', 'processing', 'finished', 'billed', 'canceled');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "ownerType" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "ncm" TEXT,
    "cfop" TEXT,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "cnpj" TEXT NOT NULL,
    "ie" TEXT,
    "cnae" TEXT,
    "certA1Keystore" BYTEA,
    "certA1Password" TEXT,
    "address" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "document" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ie" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "cityCode" TEXT,
    "complement" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "crt" TEXT,
    "district" TEXT,
    "fantasyName" TEXT,
    "im" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "number" TEXT,
    "phone" TEXT,
    "state" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "docType" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "document" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "address" TEXT,
    "city" TEXT,
    "cityCode" TEXT,
    "complement" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "crt" TEXT,
    "district" TEXT,
    "fantasyName" TEXT,
    "ie" TEXT,
    "im" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "number" TEXT,
    "state" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "zip" TEXT,
    "docType" TEXT,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_process" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_process_item" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "service_process_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "ncm" TEXT,
    "cfop" TEXT,
    "unit" TEXT DEFAULT 'UN',
    "price" DECIMAL(14,2) NOT NULL,
    "taxes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nfe" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "number" INTEGER,
    "series" INTEGER,
    "status" "NfeStatus" NOT NULL DEFAULT 'draft',
    "totalProducts" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalInvoice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "xmlPath" TEXT,
    "pdfPath" TEXT,
    "sefazProtocol" TEXT,
    "sefazMsg" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nfe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfeItem" (
    "id" TEXT NOT NULL,
    "nfeId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "cfop" TEXT,
    "ncm" TEXT,
    "qty" DECIMAL(14,4) NOT NULL,
    "unit" TEXT,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "taxes" JSONB,

    CONSTRAINT "NfeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfeEvent" (
    "id" TEXT NOT NULL,
    "nfeId" TEXT NOT NULL,
    "type" "NfeEventType" NOT NULL,
    "payload" JSONB,
    "protocol" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receivable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "nfeId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "ReceivableStatus" NOT NULL DEFAULT 'open',
    "paymentMethod" "PaymentMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "details" JSONB,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "nfeReceivedId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "PayableStatus" NOT NULL DEFAULT 'open',
    "paymentMethod" "PaymentMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayablePayment" (
    "id" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayablePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processId" TEXT,
    "customerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedTo" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMoveType" NOT NULL,
    "qty" DECIMAL(18,6) NOT NULL,
    "unitCost" DECIMAL(18,6),
    "ownership" "StockOwnership" NOT NULL DEFAULT 'own',
    "supplierId" TEXT,
    "customerId" TEXT,
    "pairId" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfeImport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "emitente" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "valorTotal" DECIMAL(18,2) NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL,
    "xmlPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfeImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tenant_name_idx" ON "Tenant"("name");

-- CreateIndex
CREATE INDEX "catalog_product_tenantId_companyId_idx" ON "catalog_product"("tenantId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_cnpj_key" ON "Company"("cnpj");

-- CreateIndex
CREATE INDEX "Company_tenantId_idx" ON "Company"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_document_key" ON "Customer"("document");

-- CreateIndex
CREATE INDEX "Customer_document_idx" ON "Customer"("document");

-- CreateIndex
CREATE INDEX "Customer_tenantId_companyId_idx" ON "Customer"("tenantId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_document_key" ON "Supplier"("document");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_companyId_idx" ON "Supplier"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "Supplier_document_idx" ON "Supplier"("document");

-- CreateIndex
CREATE INDEX "service_process_tenantId_companyId_idx" ON "service_process"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "service_process_item_processId_idx" ON "service_process_item"("processId");

-- CreateIndex
CREATE INDEX "Product_tenantId_companyId_idx" ON "Product"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "Nfe_tenantId_companyId_status_idx" ON "Nfe"("tenantId", "companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Nfe_tenantId_companyId_series_number_key" ON "Nfe"("tenantId", "companyId", "series", "number");

-- CreateIndex
CREATE INDEX "NfeItem_nfeId_idx" ON "NfeItem"("nfeId");

-- CreateIndex
CREATE INDEX "NfeEvent_nfeId_type_idx" ON "NfeEvent"("nfeId", "type");

-- CreateIndex
CREATE INDEX "Receivable_tenantId_companyId_status_idx" ON "Receivable"("tenantId", "companyId", "status");

-- CreateIndex
CREATE INDEX "Receivable_customerId_dueDate_idx" ON "Receivable"("customerId", "dueDate");

-- CreateIndex
CREATE INDEX "Payment_receivableId_paidAt_idx" ON "Payment"("receivableId", "paidAt");

-- CreateIndex
CREATE INDEX "Payable_tenantId_companyId_status_idx" ON "Payable"("tenantId", "companyId", "status");

-- CreateIndex
CREATE INDEX "Payable_supplierId_dueDate_idx" ON "Payable"("supplierId", "dueDate");

-- CreateIndex
CREATE INDEX "PayablePayment_payableId_paidAt_idx" ON "PayablePayment"("payableId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "Warehouse_tenantId_companyId_idx" ON "Warehouse"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "work_order_tenantId_companyId_idx" ON "work_order"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_companyId_productId_warehouseId_idx" ON "StockMovement"("tenantId", "companyId", "productId", "warehouseId");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_companyId_ownership_idx" ON "StockMovement"("tenantId", "companyId", "ownership");

-- CreateIndex
CREATE INDEX "StockMovement_pairId_idx" ON "StockMovement"("pairId");

-- CreateIndex
CREATE UNIQUE INDEX "NfeImport_accessKey_key" ON "NfeImport"("accessKey");

-- CreateIndex
CREATE INDEX "NfeImport_tenantId_companyId_idx" ON "NfeImport"("tenantId", "companyId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_process_item" ADD CONSTRAINT "service_process_item_processId_fkey" FOREIGN KEY ("processId") REFERENCES "service_process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nfe" ADD CONSTRAINT "Nfe_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nfe" ADD CONSTRAINT "Nfe_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nfe" ADD CONSTRAINT "Nfe_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeItem" ADD CONSTRAINT "NfeItem_nfeId_fkey" FOREIGN KEY ("nfeId") REFERENCES "Nfe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeEvent" ADD CONSTRAINT "NfeEvent_nfeId_fkey" FOREIGN KEY ("nfeId") REFERENCES "Nfe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_nfeId_fkey" FOREIGN KEY ("nfeId") REFERENCES "Nfe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayablePayment" ADD CONSTRAINT "PayablePayment_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "Payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
