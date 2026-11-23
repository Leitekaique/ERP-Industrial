-- ============================================================
-- Atualiza CSOSN para '400' em produtos sob suspensão ICMS
-- Art. 402 RICMS/SP — industrialização por encomenda
--
-- Contexto: produtos importados via REMESSA_IND/TRIANGULACAO
-- recebiam csosn='900' por padrão. Para CFOPs de industrialização
-- (5124, 5902, 5125, 5925 etc.), o CSOSN correto é 400 (sem
-- transferência de crédito — ICMS suspenso).
-- A emissão de NF já está corrigida no código (override em runtime),
-- mas esta atualização limpa o cadastro para consistência visual.
--
-- Execução: docker exec -i erp_db psql -U postgres -d erp
-- ============================================================

BEGIN;

-- Verificação antes de atualizar
SELECT
  cfop,
  taxes->>'csosn' AS csosn_atual,
  COUNT(*) AS total_produtos
FROM "Product"
WHERE cfop IN ('5902','6902','5903','6903','5124','6124','5125','6125','5925','6925','5916','6916','5949','6949')
  AND taxes IS NOT NULL
  AND taxes::jsonb ? 'csosn'
  AND taxes::jsonb->>'csosn' != '400'
GROUP BY cfop, taxes->>'csosn'
ORDER BY cfop;

-- Atualização
UPDATE "Product"
SET taxes = jsonb_set(taxes::jsonb, '{csosn}', '"400"')::json
WHERE cfop IN ('5902','6902','5903','6903','5124','6124','5125','6125','5925','6925','5916','6916','5949','6949')
  AND taxes IS NOT NULL
  AND taxes::jsonb ? 'csosn'
  AND taxes::jsonb->>'csosn' != '400';

-- Confirmação
SELECT
  cfop,
  taxes->>'csosn' AS csosn_apos,
  COUNT(*) AS total_produtos
FROM "Product"
WHERE cfop IN ('5902','6902','5903','6903','5124','6124','5125','6125','5925','6925','5916','6916','5949','6949')
  AND taxes IS NOT NULL
GROUP BY cfop, taxes->>'csosn'
ORDER BY cfop;

COMMIT;
