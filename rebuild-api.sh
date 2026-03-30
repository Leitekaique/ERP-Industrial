#!/bin/bash
# Recompila o backend dentro do container e reinicia sem rebuild da imagem
set -e

echo "📦 Copiando tsconfigs para o container..."
docker cp tsconfig.json erp_api:/usr/src/app/tsconfig.json
docker cp tsconfig.build.json erp_api:/usr/src/app/tsconfig.build.json
docker cp tsconfig.base.json erp_api:/usr/src/app/tsconfig.base.json

echo "🔨 Compilando NestJS dentro do container..."
docker exec erp_api npm run build

echo "🔄 Reiniciando container..."
docker restart erp_api

echo "✅ API atualizada com sucesso!"
