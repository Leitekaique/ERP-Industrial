-- Colunas que existem no schema.prisma mas foram criadas por scripts SQL manuais
-- (docs/*.sql) e nunca tiveram migração. IF NOT EXISTS torna esta migração
-- segura em qualquer banco: onde a coluna já existe (produção), nada acontece;
-- onde falta (instalação nova / dev), ela é criada.

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "email" TEXT;

ALTER TABLE "Nfe" ADD COLUMN IF NOT EXISTS "informacoesAdicionais" TEXT;
ALTER TABLE "Nfe" ADD COLUMN IF NOT EXISTS "endTransportadora" TEXT;
ALTER TABLE "Nfe" ADD COLUMN IF NOT EXISTS "ieTransportadora" TEXT;
ALTER TABLE "Nfe" ADD COLUMN IF NOT EXISTS "municipioTransportadora" TEXT;
ALTER TABLE "Nfe" ADD COLUMN IF NOT EXISTS "ufTransportadora" TEXT;

ALTER TABLE "Receivable" ADD COLUMN IF NOT EXISTS "nfeNumbers" TEXT;
