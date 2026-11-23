-- ============================================================================
-- DIAGNÓSTICO DO ESTOQUE — SOMENTE LEITURA (não altera nada)
--
-- Rodar DEPOIS da atualização que traz a migração 20261123130000_estoque_vinculo_lote
-- (ela liga movimentos a lotes; sem ela este script não funciona).
--
-- No PC do cliente (PowerShell):
--   Get-Content .\scripts\diagnostico-estoque.sql | docker exec -i erp_db psql -U postgres -d erp
-- ou, para guardar o resultado num arquivo:
--   Get-Content .\scripts\diagnostico-estoque.sql | docker exec -i erp_db psql -U postgres -d erp > diagnostico.txt
--
-- Toda a execução roda numa transação somente leitura.
-- ============================================================================
BEGIN TRANSACTION READ ONLY;

\echo ''
\echo '==== 1. RESUMO ===='
SELECT
  (SELECT count(*) FROM "StockLot")                                              AS lotes,
  (SELECT count(*) FROM "StockLot" WHERE "qtyRemaining" >= 0.005)                AS lotes_com_saldo,
  (SELECT count(*) FROM "StockLot" WHERE "qtyRemaining" < 0)                     AS lotes_negativos,
  (SELECT count(*) FROM "StockLot" WHERE "qtyRemaining" > 0 AND "qtyRemaining" < 0.005) AS lotes_com_residuo,
  (SELECT count(*) FROM "StockLot" WHERE "unit" IS NULL)                         AS lotes_sem_unidade,
  (SELECT count(*) FROM "StockMovement")                                         AS movimentos,
  (SELECT count(*) FROM "StockMovement" WHERE "lotId" IS NULL)                   AS movimentos_sem_lote;

\echo ''
\echo '==== 2. LOTES COM SALDO NEGATIVO (erro: saiu mais do que entrou) ===='
SELECT l."id" AS lote, p."sku", p."name" AS produto, l."unit", l."qtyInitial", l."qtyRemaining", l."reference"
FROM "StockLot" l JOIN "Product" p ON p."id" = l."productId"
WHERE l."qtyRemaining" < 0
ORDER BY l."qtyRemaining";

\echo ''
\echo '==== 3. PRODUTOS COM LOTES EM UNIDADES DIFERENTES (a saída antiga podia baixar a unidade errada) ===='
SELECT p."sku", p."name" AS produto, p."unit" AS unidade_cadastro,
       string_agg(DISTINCT coalesce(l."unit", p."unit" || ' (do cadastro)'), ', ') AS unidades_dos_lotes,
       count(*) AS lotes_com_saldo
FROM "StockLot" l JOIN "Product" p ON p."id" = l."productId"
WHERE l."qtyRemaining" >= 0.005
GROUP BY p."id", p."sku", p."name", p."unit"
HAVING count(DISTINCT upper(coalesce(l."unit", p."unit"))) > 1
ORDER BY p."name";

\echo ''
\echo '==== 4. LOTES SEM UNIDADE vindos de NF importada (unidade da NF não foi gravada) ===='
SELECT l."id" AS lote, p."sku", p."name" AS produto, p."unit" AS unidade_cadastro, l."qtyRemaining", l."reference", l."occurredAt"::date AS data_nf
FROM "StockLot" l JOIN "Product" p ON p."id" = l."productId"
WHERE l."unit" IS NULL AND l."qtyRemaining" >= 0.005
ORDER BY l."occurredAt";

\echo ''
\echo '==== 5. CONFERÊNCIA DE SALDO POR LOTE (movimentos ligados ao lote x saldo gravado) ===='
\echo '     diferenca > 0  → o lote tem MAIS saldo do que os movimentos explicam'
\echo '     diferenca < 0  → saiu do lote algo SEM movimento ligado (saídas antigas, antes do vínculo)'
WITH mov AS (
  SELECT "lotId",
         sum(CASE WHEN "type" = 'in'  THEN "qty" ELSE 0 END) AS entradas,
         sum(CASE WHEN "type" = 'out' THEN "qty" ELSE 0 END) AS saidas,
         bool_or("type" = 'in' AND coalesce("note", '') NOT LIKE 'Estorno%') AS tem_entrada_original
  FROM "StockMovement" WHERE "lotId" IS NOT NULL GROUP BY "lotId"
), calc AS (
  SELECT l."id", l."productId", l."unit", l."qtyInitial", l."qtyRemaining", l."reference",
         coalesce(m.entradas, 0) AS entradas, coalesce(m.saidas, 0) AS saidas,
         CASE WHEN coalesce(m.tem_entrada_original, false)
              THEN coalesce(m.entradas, 0) - coalesce(m.saidas, 0)
              ELSE l."qtyInitial" + coalesce(m.entradas, 0) - coalesce(m.saidas, 0) END AS saldo_esperado
  FROM "StockLot" l LEFT JOIN mov m ON m."lotId" = l."id"
)
SELECT c."id" AS lote, p."sku", p."name" AS produto, coalesce(c."unit", p."unit") AS unidade,
       c."qtyInitial" AS inicial, c.entradas, c.saidas, c.saldo_esperado,
       c."qtyRemaining" AS saldo_gravado,
       round(c."qtyRemaining" - c.saldo_esperado, 4) AS diferenca
FROM calc c JOIN "Product" p ON p."id" = c."productId"
WHERE abs(c."qtyRemaining" - c.saldo_esperado) > 0.005
ORDER BY abs(c."qtyRemaining" - c.saldo_esperado) DESC
LIMIT 200;

\echo ''
\echo '==== 6. DONO DO LOTE INEXISTENTE (empresaId não é Tapajós, cliente nem fornecedor) ===='
SELECT l."id" AS lote, p."name" AS produto, l."empresaId", l."qtyRemaining"
FROM "StockLot" l JOIN "Product" p ON p."id" = l."productId"
WHERE l."empresaId" NOT IN (SELECT "id" FROM "Company")
  AND l."empresaId" NOT IN (SELECT "id" FROM "Customer")
  AND l."empresaId" NOT IN (SELECT "id" FROM "Supplier");

\echo ''
\echo '==== 7. SALDO POR DONO E UNIDADE (visão geral) ===='
SELECT CASE
         WHEN l."empresaId" IN (SELECT "id" FROM "Company")  THEN 'Tapajós'
         WHEN l."empresaId" IN (SELECT "id" FROM "Customer") THEN 'Cliente (terceiro)'
         WHEN l."empresaId" IN (SELECT "id" FROM "Supplier") THEN 'Fornecedor (insumo a converter)'
         ELSE 'Desconhecido' END AS dono,
       coalesce(l."unit", p."unit") AS unidade,
       count(*) AS lotes, round(sum(l."qtyRemaining"), 2) AS saldo
FROM "StockLot" l JOIN "Product" p ON p."id" = l."productId"
WHERE l."qtyRemaining" >= 0.005
GROUP BY 1, 2 ORDER BY 1, 2;

\echo ''
\echo '==== 8. MOVIMENTOS SEM LOTE LIGADO, POR ORIGEM (operações antigas não rastreáveis) ===='
SELECT "type",
       CASE
         WHEN "note" LIKE 'TRANSFER_%'        THEN 'transferência'
         WHEN "note" LIKE 'CONVERSAO_UNIDADE%' OR "note" LIKE 'Conv.%' THEN 'conversão de unidade'
         WHEN "note" LIKE 'Entrada via NF%'   THEN 'importação de NF'
         WHEN "reference" LIKE 'NF_DRAFT:%'   THEN 'baixa por NF emitida'
         WHEN "reference" LIKE 'ESTORNO_%'    THEN 'estorno'
         ELSE 'manual / outros' END AS origem,
       count(*) AS movimentos
FROM "StockMovement" WHERE "lotId" IS NULL
GROUP BY 1, 2 ORDER BY 1, 3 DESC;

\echo ''
\echo '==== 9. LOTES DE NF IMPORTADA SEM VÍNCULO COM A NF (exclusão da NF não os encontra) ===='
SELECT count(*) AS lotes_sem_vinculo
FROM "StockLot" l
WHERE l."nfeImportId" IS NULL AND l."processo" IN ('Industrializacao', 'Insumo')
  AND EXISTS (SELECT 1 FROM "StockMovement" m WHERE m."lotId" = l."id" AND m."note" LIKE 'Entrada via NF%');

ROLLBACK;
