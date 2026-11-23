-- Estoque: liga cada movimento ao lote que ele afetou e cada lote à NF
-- importada que o originou. Até aqui essas ligações existiam só como texto
-- (observação "… - lote <id>" e número da NF), o que deixava o histórico do
-- lote incompleto, os estornos frágeis e a exclusão de NF importada capaz de
-- apagar lotes de outro fornecedor com o mesmo número de NF.
-- Todas as colunas são opcionais (NULL): nada existente quebra.

ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "lotId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "StockLot" ADD COLUMN IF NOT EXISTS "nfeImportId" TEXT;

ALTER TABLE "StockMovement" DROP CONSTRAINT IF EXISTS "StockMovement_lotId_fkey";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "StockLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockLot" DROP CONSTRAINT IF EXISTS "StockLot_nfeImportId_fkey";
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_nfeImportId_fkey"
  FOREIGN KEY ("nfeImportId") REFERENCES "NfeImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "StockMovement_lotId_idx" ON "StockMovement"("lotId");
CREATE INDEX IF NOT EXISTS "StockLot_nfeImportId_idx" ON "StockLot"("nfeImportId");

-- ── Preenche registros antigos (só quando a correspondência é inequívoca) ──

-- 1) Movimentos com "lote <uuid>" na observação (NF emitida, estornos)
UPDATE "StockMovement" m
SET "lotId" = substring(m."note" from 'lote ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
WHERE m."lotId" IS NULL
  AND m."note" ~ 'lote [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  AND EXISTS (SELECT 1 FROM "StockLot" l
              WHERE l."id" = substring(m."note" from 'lote ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'));

-- 2) Lote ↔ NF importada: mesma NF (série-número, número ou chave) E mesma data de emissão
UPDATE "StockLot" l
SET "nfeImportId" = n."id"
FROM "NfeImport" n
WHERE l."nfeImportId" IS NULL
  AND l."tenantId" = n."tenantId" AND l."companyId" = n."companyId"
  AND l."occurredAt" = n."dataEmissao"
  AND l."reference" IN (coalesce(n."serie" || '-' || n."nfNumber", ''), coalesce(n."nfNumber", ''), n."accessKey")
  AND (SELECT count(*) FROM "NfeImport" n2
       WHERE n2."tenantId" = l."tenantId" AND n2."companyId" = l."companyId"
         AND n2."dataEmissao" = l."occurredAt"
         AND l."reference" IN (coalesce(n2."serie" || '-' || n2."nfNumber", ''), coalesce(n2."nfNumber", ''), n2."accessKey")) = 1;

-- 3) Movimento de entrada da importação ↔ lote: mesmo produto, mesma quantidade,
--    nota "Entrada via NF <referência do lote>" e criados juntos (até 10 s)
UPDATE "StockMovement" m
SET "lotId" = l."id"
FROM "StockLot" l
WHERE m."lotId" IS NULL AND m."type" = 'in'
  AND m."productId" = l."productId"
  AND m."note" = 'Entrada via NF ' || l."reference"
  AND m."qty" = l."qtyInitial"
  AND abs(extract(epoch FROM (m."createdAt" - l."createdAt"))) <= 10
  AND (SELECT count(*) FROM "StockLot" l2
       WHERE l2."productId" = m."productId" AND m."note" = 'Entrada via NF ' || l2."reference"
         AND l2."qtyInitial" = m."qty"
         AND abs(extract(epoch FROM (m."createdAt" - l2."createdAt"))) <= 10) = 1;

-- 4) Unidade do movimento = unidade do lote (ou do produto, se o lote não tiver)
UPDATE "StockMovement" m
SET "unit" = coalesce(l."unit", p."unit")
FROM "StockLot" l JOIN "Product" p ON p."id" = l."productId"
WHERE m."unit" IS NULL AND m."lotId" = l."id";
