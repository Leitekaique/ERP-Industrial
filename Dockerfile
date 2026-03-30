# ============================
# 1) Builder
# ============================
FROM node:22-bullseye-slim AS builder

WORKDIR /usr/src/app

# Copia package.json e instala dependências
COPY package*.json ./
RUN npm ci

# Instala dependências essenciais antes do prisma generate
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# Copia o schema Prisma e gera o client
COPY prisma ./prisma
RUN npm install prisma @prisma/client
RUN npx prisma generate --schema=./prisma/schema.prisma --no-hints

# Copia o código e compila o NestJS
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# ============================
# 2) Runtime
# ============================
FROM node:22-bullseye-slim AS runtime

WORKDIR /usr/src/app

# Instala libs necessárias no container
RUN apt-get update && apt-get install -y \
  openssl \
  libssl-dev \
  ca-certificates \
  netcat-traditional \
  && rm -rf /var/lib/apt/lists/*

# Copia o build e dependências do builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/package*.json ./
COPY docker/entrypoint.sh ./entrypoint.sh

RUN chmod +x entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
