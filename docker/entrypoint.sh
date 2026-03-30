#!/bin/sh
set -e

echo "=========================================="
echo "🚀 Iniciando ERP Tapajós API (${NODE_ENV})"
echo "=========================================="

echo "⏳ Aguardando banco de dados (PostgreSQL)..."
until nc -z db 5432; do
  sleep 1
done
echo "✅ Banco disponível, iniciando aplicação..."

# --------------------------------------------------------
# ⚙️ Verifica se o Prisma Client existe
# --------------------------------------------------------
if [ ! -d "node_modules/@prisma/client" ]; then
  echo "📦 Prisma Client não encontrado — gerando..."
  npx prisma generate --schema=./prisma/schema.prisma --no-hints
else
  echo "✅ Prisma Client encontrado."
fi

# --------------------------------------------------------
# 🗃️ Executa migrações
# --------------------------------------------------------
echo "🗃️ Executando migrações Prisma..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

# --------------------------------------------------------
# 🌱 Executa seed apenas se a Company não existir
# --------------------------------------------------------
echo "🌱 Verificando se seed inicial é necessário..."
COMPANY_COUNT=$(npx prisma db execute --schema=./prisma/schema.prisma --stdin <<'SQL'
SELECT COUNT(*) FROM "Company";
SQL
)

if [ "$COMPANY_COUNT" -eq 0 ]; then
  echo "🌱 Nenhuma empresa encontrada. Rodando seed inicial..."
  node prisma/seed.cjs
else
  echo "✅ Seed já aplicado anteriormente."
fi

echo "------------------------------------------"
echo "🏁 Iniciando servidor NestJS..."
echo "------------------------------------------"

node dist/main.js
