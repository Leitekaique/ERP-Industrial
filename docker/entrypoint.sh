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
# O "prisma db execute" NÃO devolve o resultado do SELECT (só "Script executed
# successfully."), por isso a contagem é feita com o Prisma Client.
# Imprime o número de empresas, ou -1 se não conseguir contar.
COMPANY_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.company.count()
  .then((n) => console.log(n))
  .catch(() => console.log(-1))
  .finally(() => p.\$disconnect());
" 2>/dev/null | tail -n 1)

case "$COMPANY_COUNT" in
  0)
    echo "🌱 Nenhuma empresa encontrada. Rodando seed inicial..."
    node prisma/seed.cjs
    ;;
  ''|-1|*[!0-9]*)
    # Na dúvida, NÃO roda o seed (rodar seed num banco com dados seria pior)
    echo "⚠️ Não foi possível contar as empresas ($COMPANY_COUNT). Seed NÃO executado."
    ;;
  *)
    echo "✅ Seed já aplicado anteriormente ($COMPANY_COUNT empresa(s))."
    ;;
esac

echo "------------------------------------------"
echo "🏁 Iniciando servidor NestJS..."
echo "------------------------------------------"

node dist/main.js
