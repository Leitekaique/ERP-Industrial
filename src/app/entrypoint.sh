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

echo "🗃️ Executando migrações Prisma..."
npx prisma migrate deploy

echo "⚙️ Gerando Prisma Client..."
npx prisma generate

echo "🌍 Ambiente: ${NODE_ENV}"
echo "🧩 Porta: ${PORT}"
echo "💾 Banco: ${DATABASE_URL}"

echo "------------------------------------------"
echo "🏁 Iniciando servidor NestJS..."
echo "------------------------------------------"

node dist/main.js
