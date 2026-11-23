# ============================
# 1) Builder
# ============================
# bookworm (Debian 12): o bullseye saiu de suporte (mesma troca feita na API em 13/10/2026)
FROM node:22-bookworm-slim AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# Variáveis de build injetadas via --build-arg (ficam embutidas no JavaScript)
ARG VITE_API_URL=http://localhost:3000
ARG VITE_TENANT_ID=T-001
ARG VITE_COMPANY_ID=C-001
# Versão exibida na barra lateral (tag git vX.Y.Z, injetada pelo GitHub Actions)
ARG VITE_APP_VERSION=dev

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_TENANT_ID=$VITE_TENANT_ID
ENV VITE_COMPANY_ID=$VITE_COMPANY_ID
ENV VITE_APP_VERSION=$VITE_APP_VERSION

RUN npm run build

# ============================
# 2) Runtime — nginx
# ============================
FROM nginx:alpine AS runtime

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
