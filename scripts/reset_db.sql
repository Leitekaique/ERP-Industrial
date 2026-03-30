-- ============================================================
-- RESET DE BASE DE DADOS - ERP Tapajós
-- ============================================================
-- Execute dentro do container:
--
--   docker exec -i erp-postgres psql -U postgres -d erp < scripts/reset_db.sql
--
-- OPÇÃO B (padrão): preserva Tenant, Company, Warehouse e Users
-- OPÇÃO A: apaga absolutamente tudo (descomente no final)
-- ============================================================

-- ============================================================
-- OPÇÃO B — Reset transacional (recomendada para testes)
-- ============================================================

TRUNCATE TABLE
  "Payment",
  "PayablePayment",
  "NfeEvent",
  "NfeItem",
  "NfeDuplicate",
  "NfePayment",
  "ProcessHistory",
  "StockMovement",
  "StockLot",
  "Receivable",
  "Billing",
  "Payable",
  "Nfe",
  "NfeImport",
  "NfeEmit",
  "process",
  "Product",
  "catalog_product",
  "Customer",
  "Supplier",
  "Transporter"
RESTART IDENTITY CASCADE;

-- ============================================================
-- OPÇÃO A — Reset COMPLETO (descomente para apagar tudo)
-- ============================================================

-- TRUNCATE TABLE
--   "Payment",
--   "PayablePayment",
--   "NfeEvent",
--   "NfeItem",
--   "NfeDuplicate",
--   "NfePayment",
--   "ProcessHistory",
--   "StockMovement",
--   "StockLot",
--   "Receivable",
--   "Billing",
--   "Payable",
--   "Nfe",
--   "NfeImport",
--   "NfeEmit",
--   "process",
--   "Product",
--   "catalog_product",
--   "Customer",
--   "Supplier",
--   "Transporter",
--   "Warehouse",
--   "users",
--   "Company",
--   "Tenant"
-- RESTART IDENTITY CASCADE;

-- ============================================================
-- Verificação pós-reset
-- ============================================================
SELECT 'Customer'        AS tabela, COUNT(*) AS registros FROM "Customer"
UNION ALL SELECT 'Supplier',       COUNT(*) FROM "Supplier"
UNION ALL SELECT 'Product',        COUNT(*) FROM "Product"
UNION ALL SELECT 'process',        COUNT(*) FROM "process"
UNION ALL SELECT 'StockLot',       COUNT(*) FROM "StockLot"
UNION ALL SELECT 'StockMovement',  COUNT(*) FROM "StockMovement"
UNION ALL SELECT 'Nfe',            COUNT(*) FROM "Nfe"
UNION ALL SELECT 'Receivable',     COUNT(*) FROM "Receivable"
UNION ALL SELECT 'Billing',        COUNT(*) FROM "Billing"
UNION ALL SELECT 'Payable',        COUNT(*) FROM "Payable"
UNION ALL SELECT 'Warehouse',      COUNT(*) FROM "Warehouse"
UNION ALL SELECT 'users',          COUNT(*) FROM "users"
UNION ALL SELECT 'Company',        COUNT(*) FROM "Company"
UNION ALL SELECT 'Tenant',         COUNT(*) FROM "Tenant"
ORDER BY tabela;
