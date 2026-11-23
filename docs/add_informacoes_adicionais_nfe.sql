-- Adiciona coluna informacoesAdicionais ao modelo Nfe
-- Executar: Get-Content .\docs\add_informacoes_adicionais_nfe.sql | docker exec -i erp_db psql -U postgres -d erp
ALTER TABLE "Nfe" ADD COLUMN IF NOT EXISTS "informacoesAdicionais" TEXT;
