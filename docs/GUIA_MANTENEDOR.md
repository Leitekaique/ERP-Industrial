# Guia do Mantenedor — ERP Tapajós

> Documento de referência para o desenvolvedor que herda, mantém ou faz deploy do sistema ERP Tapajós.
> Escrito em março de 2026 com base no estado atual do projeto.

---

## Índice

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Arquitetura](#2-arquitetura)
3. [Como Rodar o Sistema](#3-como-rodar-o-sistema)
4. [Rebuild após mudanças no backend](#4-rebuild-após-mudanças-no-backend)
5. [Banco de Dados](#5-banco-de-dados)
6. [Variáveis de Ambiente](#6-variáveis-de-ambiente)
7. [Fluxo de Negócio (visão técnica)](#7-fluxo-de-negócio-visão-técnica)
8. [Emissão de NF-e](#8-emissão-de-nf-e)
9. [Problemas Comuns e Soluções](#9-problemas-comuns-e-soluções)
10. [Preparação para Deploy em Produção](#10-preparação-para-deploy-em-produção)
11. [Backup e Recuperação](#11-backup-e-recuperação)
12. [Estrutura de Arquivos Importantes](#12-estrutura-de-arquivos-importantes)
13. [Suporte Remoto: Logs, Sentry e Tailscale](#13-suporte-remoto-logs-sentry-e-tailscale)
14. [Atualização do Cliente: Pipeline de Versões](#14-atualização-do-cliente-pipeline-de-versões)

---

## 1. Visão Geral do Sistema

O ERP Tapajós é um sistema de gestão empresarial desenvolvido sob medida para a **Peletização Têxtil Tapajós**, empresa do ramo de beneficiamento têxtil (processos como dublagem, laminação, refile, reprocesso). O sistema cobre o ciclo operacional completo: entrada de material de terceiros, controle de estoque, registro de processos de beneficiamento, emissão de NF-e, faturamento e contas a pagar/receber.

### Stack tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend (API) | NestJS (Node.js + TypeScript) |
| ORM / Migrações | Prisma |
| Banco de dados | PostgreSQL 15 |
| Frontend | React + Vite + TailwindCSS (TypeScript) |
| Infraestrutura | Docker / Docker Compose |
| Emissão NF-e | XML assinado com certificado A1, envio SEFAZ-SP |
| E-mail | Nodemailer (SMTP Gmail ou configurável) |

---

## 2. Arquitetura

### Diagrama de componentes

```
┌──────────────────────────────────────────────────────────────────┐
│  Rede Docker: erp_network                                        │
│                                                                  │
│   ┌─────────────────────┐       ┌──────────────────────────┐    │
│   │   container: erp_api │       │   container: erp_db      │    │
│   │   NestJS             │──────▶│   PostgreSQL 15          │    │
│   │   porta 3000 (API)   │       │   porta 5432             │    │
│   │   porta 5555 (Studio)│       │   volume: postgres_data  │    │
│   └─────────────────────┘       └──────────────────────────┘    │
│          │                                                        │
│          │ volumes montados no host:                              │
│          │  ./uploads  → /usr/src/app/uploads                    │
│          │  ./logs     → /usr/src/app/logs                       │
│          │  ./src      → /usr/src/app/src   (dev, cached)        │
│          │  ./prisma   → /usr/src/app/prisma (dev, cached)       │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Host / máquina local                   │
│   Frontend React (Vite dev server)      │
│   porta 5173                            │
│   aponta para API em localhost:3000     │
└─────────────────────────────────────────┘
```

> O frontend é servido diretamente pelo Vite no host (não está dentro do Docker). Em produção, o build do Vite pode ser servido por Nginx ou outro servidor estático.

### Módulos do backend (`src/modules/`)

| Módulo | Responsabilidade |
|--------|-----------------|
| `auth` | Autenticação JWT, controle de roles (ADMIN / MANAGER), guards de rota |
| `companies` | Cadastro da empresa emissora (Tapajós), incluindo certificado digital A1 |
| `customers` | Cadastro de clientes, incluindo prazo de cobrança (`billingTerms`) |
| `suppliers` | Cadastro de fornecedores |
| `products` | Produtos por empresa/cliente; SKU, NCM, CFOP, preço |
| `catalog` | Produtos globais de catálogo (referência sem vínculo de estoque) |
| `inventory` | Movimentação de estoque (entrada, saída, transferência), depósitos, lotes |
| `processes` | Processos de beneficiamento cadastrados por cliente (dublagem, laminação etc.) |
| `process-history` | Auditoria de eventos ligados a processos: entrada NF, saída NF, conversão de unidade |
| `nfe-emit` | Emissão de NF-e: rascunho, finalização, assinatura XML, envio SEFAZ, DANFE PDF, cancelamento, CC-e |
| `nfe-import` | Importação de XML de NF-e de entrada (fornecedores); geração automática de contas a pagar |
| `nfe-emit` (NfeEmit legado) | Modelo legado `NfeEmit` — mantido para compatibilidade; não usar para novas emissões |
| `finance` | Contas a receber (`Receivable`) e pagamentos |
| `payables` | Contas a pagar (`Payable`) e pagamentos |
| `billing` | Faturamento: agrupa recebíveis em `Billing` (duplicata/fatura), gera PDF, envia por e-mail |
| `dashboard` | Indicadores agregados: faturamento, produção, fluxo de caixa |
| `mail` | Serviço centralizado de envio de e-mail via SMTP (Nodemailer) |
| `transporter` | Cadastro de transportadoras |
| `empresa-origem` | Referência às empresas clientes que enviam material para beneficiamento |
| `fiscal` | Utilitários fiscais auxiliares |
| `health` | Endpoint de health check da API (`GET /health`) |

### Páginas do frontend (`web/src/pages/`)

| Pasta | Telas |
|-------|-------|
| `auth` | LoginPage — autenticação JWT |
| `dashboard` | DashboardPage — indicadores, gráficos, top clientes |
| `nfe-emit` | NfeList, NfeDraftDetailPage, NfeForm, NfeEmitFromStockPage, NFePreview, CancelNfeModal, CceModal |
| `nfe-import` | Importação de XMLs de NF-e de entrada |
| `inventory` | StockPage, StockMoveForm, StockHistoryPage, StockHistoryListPage, WarehousesList, WarehousesForm |
| `products` | Lista e formulário de produtos |
| `processes` | ProcessesList, ProcessesForm — cadastro de processos por cliente |
| `customers` | Lista e formulário de clientes |
| `suppliers` | Lista e formulário de fornecedores |
| `transporter` | Lista e formulário de transportadoras |
| `billing` | BillingList — faturas/duplicatas |
| `receivables` | ReceivablesList, ReceivableForm — contas a receber |
| `payables` | Lista e formulário de contas a pagar |
| `financeiro` | FinanceiroHistoricoPage — histórico financeiro consolidado |

---

## 3. Como Rodar o Sistema

### Pré-requisitos

- Docker Desktop instalado e em execução
- Node.js 18+ (apenas para rodar o frontend Vite fora do Docker)
- Git (para clonar / atualizar o repositório)

### Iniciar os serviços

```bash
# Na raiz do projeto (e:/ERP ou equivalente)
docker compose up -d
```

Isso sobe dois containers:
- `erp_db` — PostgreSQL 15
- `erp_api` — NestJS (executa `entrypoint.sh` que roda migrações Prisma e inicia o servidor)

### Iniciar o frontend

```bash
cd web
npm install   # apenas na primeira vez
npm run dev
```

### Acessar o sistema

| Serviço | URL |
|---------|-----|
| Frontend (React) | http://localhost:5173 |
| API (REST) | http://localhost:3000 |
| Prisma Studio | http://localhost:5555 |

### Verificar se está rodando

```bash
# Status dos containers
docker compose ps

# Logs da API (tempo real)
docker logs -f erp_api

# Logs do banco
docker logs erp_db

# Health check rápido
curl http://localhost:3000/health
```

---

## 4. Rebuild após mudanças no backend

O container `erp_api` roda o código **compilado** (`dist/main.js`). Mudanças em `src/` não são aplicadas automaticamente — é necessário recompilar.

### Quando rebuildar

- Qualquer alteração em `src/` (controllers, services, DTOs, utilitários)
- Alterações em `prisma/schema.prisma` seguidas de nova migração

### Como rebuildar

```bash
# Na raiz do projeto
./rebuild-api.sh
```

O script executa:
1. Copia os arquivos `tsconfig*.json` para dentro do container
2. Compila o NestJS dentro do container (`npm run build`)
3. Reinicia o container (`docker restart erp_api`)

### Reconstruir a imagem do zero (quando necessário)

Se houver mudanças no `Dockerfile`, instalação de novas dependências (`package.json`) ou troca de variáveis de ambiente no `.env.dev`:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Rodar migrações Prisma após mudança no schema

Migrações devem ser criadas e aplicadas **dentro do container**:

```bash
# Aplicar migrações pendentes (produção / deploy)
docker exec erp_api sh -c "cd /usr/src/app && npx prisma migrate deploy"

# Criar nova migração (dev) — dá nome descritivo
docker exec erp_api sh -c "cd /usr/src/app && npx prisma migrate dev --name nome_da_migracao"
```

---

## 5. Banco de Dados

### Acesso direto ao PostgreSQL

```bash
# Shell psql interativo
docker exec -it erp_db psql -U postgres -d erp

# Exemplos de queries úteis
# Ver todas as NFs emitidas
SELECT id, number, series, status, "issuedAt" FROM "Nfe" ORDER BY "issuedAt" DESC LIMIT 20;

# Ver próximo número de NF
SELECT MAX(number) FROM "Nfe" WHERE "tenantId" = 'T-001' AND "companyId" = 'C-001';

# Ver billing em aberto
SELECT id, "billingNumber", "totalAmount", status, "dueDate" FROM "Billing" WHERE status = 'open';
```

### Prisma Studio (interface visual)

Acesse `http://localhost:5555` para navegar pelos dados graficamente.

O Prisma Studio é iniciado automaticamente junto com o container da API (exposto na porta 5555).

### Modelos de dados principais

| Tabela | Descrição |
|--------|-----------|
| `Tenant` | Tenant raiz (isolamento multi-empresa) |
| `Company` | Empresa emissora (Tapajós) — guarda o certificado A1 |
| `Customer` | Clientes (empresas que mandam material p/ beneficiamento) |
| `Supplier` | Fornecedores |
| `Product` | Produtos vinculados a cliente/empresa/SKU |
| `StockLot` | Lotes de estoque por depósito |
| `StockMovement` | Movimentações de entrada, saída e transferência |
| `Process` | Processos de beneficiamento cadastrados por cliente |
| `ProcessHistory` | Auditoria de eventos de processo/estoque/NF |
| `Nfe` | NF-e emitidas (rascunho → autorizada) |
| `NfeItem` | Itens da NF-e |
| `NfeDuplicate` | Duplicatas da cobrança dentro da NF-e |
| `NfePayment` | Formas de pagamento declaradas na NF-e |
| `NfeEvent` | Eventos da NF-e (cancelamento, CC-e, inutilização) |
| `Receivable` | Contas a receber geradas após emissão de NF |
| `Billing` | Fatura consolidada agrupando recebíveis de um cliente no mês |
| `Payable` | Contas a pagar (geradas na importação de NF de entrada) |
| `Warehouse` | Depósitos de estoque |
| `Transporter` | Transportadoras |
| `User` | Usuários do sistema (roles: ADMIN, MANAGER) |

### Backup manual

```bash
# Gerar backup (arquivo .sql no host)
docker exec erp_db pg_dump -U postgres erp > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore

```bash
# Restaurar a partir de um arquivo .sql
docker exec -i erp_db psql -U postgres erp < backup_20260330_120000.sql
```

---

## 6. Variáveis de Ambiente

O arquivo de configuração é `.env.dev` na raiz do projeto (carregado pelo `docker-compose.yml` via `env_file`).

**Nunca commitar senhas ou credenciais reais no repositório.**

### Variáveis e seus papéis

| Variável | Descrição |
|----------|-----------|
| `NODE_ENV` | `development` ou `production` — afeta logs e comportamentos internos do NestJS |
| `PORT` | Porta em que a API escuta (padrão: `3000`) |
| `DATABASE_URL` | String de conexão PostgreSQL. Em Docker: `postgresql://postgres:postgres@db:5432/erp?schema=public` |
| `DEFAULT_TENANT_ID` | ID do tenant padrão (ex: `T-001`). Usado em seeds e em contextos sem autenticação completa |
| `DEFAULT_COMPANY_ID` | ID da empresa padrão (ex: `C-001`). Identifica a Tapajós no banco |
| `JWT_SECRET` | Chave secreta para assinar tokens JWT. **Deve ser substituída em produção por uma string longa e aleatória** |
| `JWT_EXPIRES_IN` | Tempo de expiração do token JWT (ex: `24h`) |
| `SEFAZ_ENV` | Modo de comunicação com a SEFAZ. Valores aceitos: `simulator` (dev, sem certificado), `homologacao` (SEFAZ-SP, certificado obrigatório), `producao` (produção real) |
| `SEFAZ_UF` | Código IBGE da UF emissora (São Paulo = `35`) |
| `CERT_PASSWORD` | Senha do certificado digital A1 (`.pfx`). Deixar em branco em `simulator` |
| `MAIL_ENABLED` | `true` para envio real de e-mails via SMTP; `false` (ou omitido) apenas loga sem enviar |
| `SMTP_HOST` | Servidor SMTP (ex: `smtp.gmail.com`) |
| `SMTP_PORT` | Porta SMTP (`587` para TLS, `465` para SSL) |
| `SMTP_USER` | Usuário/e-mail de autenticação SMTP |
| `SMTP_PASS` | Senha ou app password do SMTP |
| `SMTP_FROM` | Endereço exibido como remetente (ex: `Tapajós Peletização <peletizacaotapajos@gmail.com>`) |
| `OFFICE_EMAIL` | E-mail do escritório contábil da Tapajós — recebe cópia de NFs emitidas e faturas |
| `VITE_API_URL` | URL da API usada pelo frontend (ex: `http://localhost:3000`) |

### Arquivo de configuração de constantes internas

Além do `.env`, há constantes em `src/config/office.config.ts`:

- `OFFICE_EMAIL` — lido do `process.env.OFFICE_EMAIL`
- `IBPT_FEDERAL_PCT` / `IBPT_ESTADUAL_PCT` — percentuais IBPT para informações adicionais da NF-e (13,45% federal / 18,00% estadual)
- `NON_BILLING_CFOPS` — CFOPs que **não** geram cobrança (`5209`, `6209`, `5902`, `6902` — retorno/devolução de material)

---

## 7. Fluxo de Negócio (visão técnica)

### Visão geral do ciclo

```
Entrada de material (NF-e de entrada)
        │
        ▼
Importação XML → cria Product + StockLot + Payable
        │
        ▼
Processo de beneficiamento registrado (Process + ProcessHistory)
        │
        ▼
Saída de estoque → opção "Gerar cobrança" → cria Receivable
        │
        ▼
Emissão NF-e de saída (Nfe draft → autorizada)
        │       └── gera Receivable automaticamente (via billingTerms do cliente)
        ▼
Faturamento (Billing) — agrupa Receivables do mês ou por prazo
        │       └── gera PDF da fatura → envia por e-mail (cliente + escritório)
        ▼
Recebimento — marca Receivable/Billing como pago
```

### Regras de `billingTerms` (prazo de cobrança do cliente)

O campo `Customer.billingTerms` define como os recebíveis são agrupados:

| Valor | Comportamento |
|-------|--------------|
| `dia15` | Acumula no mesmo Receivable mensal com vencimento dia 15 |
| `dia20` | Acumula no mesmo Receivable mensal com vencimento dia 20 |
| `7d` | Cria um Receivable individual por NF, vencendo 7 dias após emissão |
| `15d` | Cria um Receivable individual por NF, vencendo 15 dias após emissão |
| `28d` | Cria um Receivable individual por NF, vencendo 28 dias após emissão |
| `45d` | Cria um Receivable individual por NF, vencendo 45 dias após emissão |

### CFOPs utilizados

| CFOP | Operação |
|------|----------|
| `5124` / `6124` | Industrialização para terceiros (serviço/MO + insumos) |
| `5101` / `6101` | Venda de produto industrializado |
| `5902` / `6902` | Retorno de mercadoria para industrialização (não gera cobrança) |
| `5209` / `6209` | Devolução de compra (não gera cobrança) |

### Tipos de item na NF-e (`NfeItem.kind`)

| Valor | Significado |
|-------|------------|
| `BASE` | Produto do cliente sendo retornado beneficiado |
| `PMO` | Serviço / mão de obra de beneficiamento |
| `INSUMO` | Material aplicado no processo e cobrado ao cliente |

---

## 8. Emissão de NF-e

### Fluxo técnico

```
1. Criar rascunho (draft)
   POST /nfe-emit/draft
   └── status: draft

2. Preencher dados (abas: emitente, destinatário, itens, transporte, cobrança)
   PATCH /nfe-emit/:id

3. Finalizar e emitir
   POST /nfe-emit/:id/emit
   └── xml-builder.ts → monta XML NF-e 4.0
   └── xml-signer.ts  → assina com certificado A1 (node-forge)
   └── xml-sender.ts  → envia ao WebService SEFAZ-SP
   └── status: authorized (cStat=100) ou error/denied
   └── danfe-pdf.ts   → gera PDF DANFE
   └── mail.service   → envia XML + PDF ao destinatário e ao OFFICE_EMAIL

4. Cancelamento (até 24h após autorização)
   POST /nfe-emit/:id/cancel
   └── event-xml-builder.ts → XML de cancelamento
   └── event-pdf.ts         → PDF do evento
   └── status: canceled

5. CC-e (Carta de Correção Eletrônica)
   POST /nfe-emit/:id/cce
```

### Certificado digital A1

O certificado pode ser fornecido de duas formas:

**Opção A — Upload via cadastro da empresa:**
Na tela de cadastro da empresa (Tapajós), há campo para upload do arquivo `.pfx`. O certificado é armazenado no banco de dados no campo `Company.certA1Keystore` (bytes) e `Company.certA1Password`.

**Opção B — Arquivo no sistema de arquivos:**
Colocar o arquivo em `certs/tapajos-cert.pfx` na raiz do projeto. A senha deve estar em `CERT_PASSWORD` no `.env`.

### Ambientes SEFAZ

| `SEFAZ_ENV` | Comportamento |
|-------------|--------------|
| `simulator` | Resposta simulada localmente, sem certificado, sem conexão real. Ideal para desenvolvimento |
| `homologacao` | Conecta ao WebService de homologação da SEFAZ-SP. Certificado obrigatório. NFs não têm validade fiscal |
| `producao` | Conecta ao WebService de produção da SEFAZ-SP. Certificado obrigatório. NFs têm validade fiscal real |

### Numeração de NF-e

A numeração é controlada pelo campo `Nfe.number` no banco de dados. O sistema busca o maior número existente e incrementa em 1.

Para **definir um número inicial** no deploy em produção (ex: continuar a partir do 6600):

```sql
-- Inserir um registro "marcador" para forçar o próximo número
-- (ou atualizar a sequência conforme a lógica do serviço)

-- Ver o último número emitido:
SELECT MAX(number) FROM "Nfe" WHERE "tenantId" = 'T-001' AND "companyId" = 'C-001';

-- Se o banco estiver vazio e você quiser iniciar em 6600,
-- basta emitir a primeira NF e ela receberá número 1.
-- Para iniciar em 6600, inserir um registro draft com number=6599:
INSERT INTO "Nfe" ("id","tenantId","companyId","number","series","status","createdAt","updatedAt","totalProducts","totalTax","totalInvoice")
VALUES (gen_random_uuid(), 'T-001', 'C-001', 6599, 1, 'canceled', now(), now(), 0, 0, 0);
```

### Conformidade fiscal (Simples Nacional)

A Tapajós é optante pelo Simples Nacional (CRT=1). O XML gerado inclui automaticamente:
- `<CSOSN>` nos itens de ICMS (valores típicos: 102, 400, 900)
- PIS/COFINS CST `08` (não tributado — correto para beneficiamento)
- IPI CST `53`
- Disclaimers obrigatórios no `<infAdic>`: "DOC. EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL", crédito ICMS (art. 23 LC 123/2006)
- Tributos aproximados IBPT no campo de informações adicionais

---

## 9. Problemas Comuns e Soluções

### API não responde / health check falha

```bash
docker compose restart api
# ou, se o container morreu:
docker compose up -d
```

Verificar logs para identificar o erro:
```bash
docker logs erp_api --tail=100
```

### Mudança no código `src/` não reflete na API

O container roda código compilado. É necessário rebuildar:
```bash
./rebuild-api.sh
```

### Container reinicia em loop (crash loop)

```bash
docker logs erp_api --tail=50
```

Causas comuns:
- `DATABASE_URL` incorreta ou banco não disponível
- Erro de TypeScript na compilação (verificar se `dist/main.js` existe)
- Migração Prisma falhou na inicialização

### Migração Prisma falhou

```bash
# Ver o erro da migração
docker logs erp_api | grep -i migrate

# Aplicar migrações manualmente
docker exec erp_api sh -c "cd /usr/src/app && npx prisma migrate deploy"

# Se houver conflito de estado, verificar a tabela de controle:
docker exec -it erp_db psql -U postgres -d erp -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;"
```

Os arquivos `.sql` de cada migração estão em `prisma/migrations/`. Se uma migração falhou parcialmente, pode ser necessário corrigir o SQL manualmente.

### Certificado digital não encontrado

Verificar:
1. O arquivo `certs/tapajos-cert.pfx` existe?
2. A senha em `CERT_PASSWORD` está correta?
3. O certificado foi carregado via cadastro da empresa? (campo `Company.certA1Keystore` no banco)

```bash
# Verificar se o campo tem dados no banco
docker exec -it erp_db psql -U postgres -d erp -c \
  "SELECT id, \"legalName\", length(\"certA1Keystore\") as cert_bytes FROM \"Company\";"
```

### E-mail não enviado após emissão de NF ou fatura

```bash
# Verificar logs de e-mail
docker logs erp_api | grep -i mail
docker logs erp_api | grep -i smtp
docker logs erp_api | grep -i email
```

Checklist:
- `MAIL_ENABLED=true` no `.env.dev`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` preenchidos
- Se usar Gmail, verificar se "App Password" está configurado (não usar senha normal da conta)
- `OFFICE_EMAIL` preenchido para cópia ao escritório

### NF rejeitada pela SEFAZ (cStat diferente de 100)

```bash
docker logs erp_api | grep -i sefaz
docker logs erp_api | grep -i cstat
```

O campo `Nfe.sefazMsg` no banco contém a mensagem retornada pela SEFAZ em português. Verificar também `Nfe.status` (valores: `draft`, `sending`, `authorized`, `denied`, `canceled`, `error`).

Causas comuns de rejeição:
- Dados do destinatário incompletos (CNPJ, IE, endereço, código IBGE do município)
- CFOP incompatível com a operação
- NCM inválido ou ausente
- Certificado vencido ou com senha incorreta
- `SEFAZ_ENV=homologacao` usando CNPJ de produção (ou vice-versa)

### Banco de dados corrompido ou inacessível

```bash
# Verificar status do container do banco
docker compose ps
docker logs erp_db --tail=50

# Reiniciar apenas o banco (a API vai reconectar)
docker compose restart db
```

---

## 10. Preparação para Deploy em Produção

### Checklist pré-deploy

- [ ] Definir `SEFAZ_ENV=producao` no arquivo `.env` de produção
- [ ] Configurar certificado digital A1 real (arquivo `.pfx` + senha)
- [ ] Definir `JWT_SECRET` com uma string longa e aleatória (ex: `openssl rand -base64 64`)
- [ ] Definir `MAIL_ENABLED=true` e configurar `SMTP_*` com e-mail real da empresa
- [ ] Definir `OFFICE_EMAIL` com o e-mail real do escritório contábil
- [ ] Definir `OFFICE_EMAIL` também em `src/config/office.config.ts` (lido via `process.env.OFFICE_EMAIL`)
- [ ] Verificar `DEFAULT_TENANT_ID` e `DEFAULT_COMPANY_ID` — devem bater com os IDs reais no banco
- [ ] Fazer backup do banco antes de qualquer migração
- [ ] Testar envio de e-mail com `MAIL_ENABLED=true` antes de ir a ar

### Numeração inicial de NF e duplicata

A Tapajós possui histórico de NFs emitidas em sistema anterior. Ao iniciar em produção:

- **NF-e**: próximo número deve ser ~6600 (verificar última NF emitida no sistema anterior)
- **Duplicata** (`Billing.billingNumber`): próximo deve ser ~3300 (usar `autoincrement`, ajustar sequência se necessário)

Para ajustar a sequência de `billingNumber` no PostgreSQL:

```sql
-- Ver valor atual da sequência
SELECT last_value FROM "Billing_billingNumber_seq";

-- Ajustar para iniciar em 3300
SELECT setval('"Billing_billingNumber_seq"', 3299);
```

Para NF-e, inserir um registro cancelado com o último número do sistema anterior (ver seção 8).

### Primeira NF em produção

Antes de migrar dados históricos ou liberar para o usuário:
1. Emitir uma NF de teste real em produção (valor baixo)
2. Confirmar autorização pela SEFAZ (cStat=100)
3. Confirmar recebimento do e-mail com XML e DANFE
4. Verificar o PDF DANFE gerado

### Importar dados históricos

Produtos, clientes, processos e preços devem ser importados diretamente no banco de produção **antes** de liberar o sistema. Usar a funcionalidade de importação de XML histórico disponível na tela de NF-e para popular o histórico de notas.

---

## 11. Backup e Recuperação

### Backup manual

```bash
docker exec erp_db pg_dump -U postgres erp > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Backup automático via cron (Linux/Mac)

Adicionar ao crontab do servidor host (`crontab -e`):

```cron
# Backup diário às 12h00
0 12 * * * docker exec erp_db pg_dump -U postgres erp > /caminho/backups/erp_$(date +\%Y\%m\%d_\%H\%M\%S).sql

# Manter apenas os últimos 30 dias
0 13 * * * find /caminho/backups/ -name "erp_*.sql" -mtime +30 -delete
```

### Script de backup completo

```bash
#!/bin/bash
# backup-erp.sh — rodar no host
BACKUP_DIR="/caminho/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "Fazendo backup do banco..."
docker exec erp_db pg_dump -U postgres erp > "$BACKUP_DIR/erp_$DATE.sql"

echo "Comprimindo..."
gzip "$BACKUP_DIR/erp_$DATE.sql"

echo "Backup salvo em: $BACKUP_DIR/erp_$DATE.sql.gz"

# Remover backups com mais de 30 dias
find "$BACKUP_DIR" -name "erp_*.sql.gz" -mtime +30 -delete
```

### Restore

```bash
# A partir de arquivo .sql
docker exec -i erp_db psql -U postgres erp < backup_20260330_120000.sql

# A partir de arquivo .sql.gz
gunzip -c backup_20260330_120000.sql.gz | docker exec -i erp_db psql -U postgres erp
```

### Backup dos arquivos gerados

Além do banco, fazer backup periódico das pastas:
- `uploads/nfe_emitidas/` — XMLs e PDFs das NFs emitidas
- `certs/` — certificado digital

```bash
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/ certs/
```

---

## 12. Estrutura de Arquivos Importantes

```
e:/ERP/
├── src/
│   ├── app/
│   │   └── entrypoint.sh         # Script de inicialização do container
│   ├── config/
│   │   └── office.config.ts      # Constantes globais (OFFICE_EMAIL, IBPT, CFOPs)
│   ├── database/
│   │   └── prisma.service.ts     # Cliente Prisma injetável
│   └── modules/
│       ├── auth/                 # Autenticação JWT
│       ├── billing/              # Faturamento e PDF de duplicata
│       ├── companies/            # Cadastro empresa / certificado A1
│       ├── customers/            # Cadastro clientes
│       ├── dashboard/            # Indicadores e gráficos
│       ├── finance/              # Contas a receber
│       ├── inventory/            # Estoque e movimentações
│       ├── mail/                 # Envio de e-mail SMTP
│       ├── nfe-emit/             # Emissão NF-e (XML, assinatura, SEFAZ, DANFE)
│       │   └── utils/
│       │       ├── xml-builder.ts    # Montagem do XML NF-e 4.0
│       │       ├── xml-signer.ts     # Assinatura digital A1
│       │       ├── xml-sender.ts     # Envio ao WebService SEFAZ
│       │       ├── danfe-html.ts     # Template HTML do DANFE
│       │       ├── danfe-pdf.ts      # Geração do PDF DANFE
│       │       ├── event-xml-builder.ts  # XML de cancelamento e CC-e
│       │       └── event-pdf.ts      # PDF dos eventos
│       ├── nfe-import/           # Importação de NF-e de entrada
│       ├── payables/             # Contas a pagar
│       ├── processes/            # Processos de beneficiamento
│       ├── process-history/      # Auditoria de eventos
│       ├── products/             # Produtos
│       ├── suppliers/            # Fornecedores
│       └── transporter/          # Transportadoras
│
├── prisma/
│   ├── schema.prisma             # Modelo de dados (fonte da verdade)
│   ├── migrations/               # Histórico de migrações SQL
│   └── seed.cjs                  # Script de seed inicial
│
├── web/                          # Frontend React + Vite
│   ├── src/
│   │   ├── pages/                # Telas da aplicação
│   │   ├── components/           # Componentes reutilizáveis
│   │   └── api/                  # Chamadas à API (axios)
│   └── package.json
│
├── uploads/
│   └── nfe_emitidas/             # XMLs e PDFs das NFs emitidas
│
├── certs/
│   └── tapajos-cert.pfx          # Certificado digital A1 (não commitar)
│
├── logs/                         # Logs da aplicação
├── docs/                         # Documentação do projeto
│   ├── GUIA_MANTENEDOR.md        # Este documento
│   └── PENDENCIAS.md             # Histórico de pendências e testes
│
├── docker-compose.yml            # Definição dos serviços Docker
├── Dockerfile                    # Imagem Docker da API
├── .env.dev                      # Variáveis de ambiente (dev)
├── rebuild-api.sh                # Script de rebuild sem rebuild da imagem
└── package.json                  # Dependências e scripts do backend
```

---

## Apêndice: Comandos de referência rápida

```bash
# Subir tudo
docker compose up -d

# Parar tudo
docker compose down

# Ver status
docker compose ps

# Logs da API
docker logs -f erp_api

# Rebuildar backend após mudança no código
./rebuild-api.sh

# Rodar migração Prisma
docker exec erp_api sh -c "cd /usr/src/app && npx prisma migrate deploy"

# Acessar banco via psql
docker exec -it erp_db psql -U postgres -d erp

# Backup do banco
docker exec erp_db pg_dump -U postgres erp > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore do banco
docker exec -i erp_db psql -U postgres erp < backup.sql

# Reconstruir imagem do zero
docker compose down && docker compose build --no-cache && docker compose up -d

# Ver próximo número de NF
docker exec -it erp_db psql -U postgres -d erp -c \
  "SELECT MAX(number) as ultimo_numero FROM \"Nfe\" WHERE \"tenantId\" = 'T-001';"
```

---

## 13. Suporte Remoto: Logs, Sentry e Tailscale

> Objetivo: quando o cliente disser "deu erro", você consegue **ver o que aconteceu**
> sem ir até lá.
>
> O ciclo é: cliente reporta (ou o Sentry avisa por e-mail) → você entra no PC do
> cliente pelo Tailscale → lê o log → corrige no notebook → gera a nova versão →
> o cliente atualiza.

### 13.1 Onde ficam os logs

A API grava **um arquivo por dia** e também continua escrevendo no console (`docker logs`).

| Onde | Caminho |
|---|---|
| PC do cliente (Windows) | `C:\ERP-Deploy\logs\api-AAAA-MM-DD.log` |
| Dentro do container | `/usr/src/app/logs` (é a mesma pasta, montada como volume) |
| Dev (notebook, fora do Docker) | `./logs` na raiz do projeto |

- Arquivos de dias anteriores são **compactados** (`.log.gz`) e apagados depois de **30 dias**.
- Cada linha é um JSON. Exemplo de uma requisição:
  ```json
  {"context":"HTTP","level":"info","message":"GET /dashboard/summary 200 130ms","method":"GET","route":"/dashboard/summary","user":"fulano@empresa.com.br","status":200,"durationMs":130,"timestamp":"2026-11-23T21:23:57.845Z"}
  ```
- O horário (`timestamp`) está em **UTC**: subtraia 3 horas para ter o horário de Brasília.
- Configuração: `LOG_DIR` (pasta) e `LOG_LEVEL` (`error`, `warn`, `info`, `debug`) no `.env.prod`.
  Arquivos de código: `src/common/observability/`.

**O que o log registra e o que NÃO registra:**

| Registra | Nunca registra |
|---|---|
| Método e rota (o padrão, ex.: `/customers/:id`) | Corpo da requisição e da resposta (clientes, valores, CNPJs) |
| E-mail do usuário logado | Query string (`?busca=...`) |
| Status HTTP e duração | Headers, token JWT, senha |
| Mensagem do erro (CNPJ/CPF/chave mascarados) | Mensagens do Prisma (podem conter a query inteira) |
| Tudo o que os serviços escrevem com `this.logger.log/warn/error` | `console.log` (vai só para o `docker logs`) |

> ⚠️ Os serviços podem escrever nomes de clientes nas próprias mensagens
> (`this.logger.log(...)`). O arquivo fica **no PC do cliente**, mas trate-o como
> confidencial: **nunca** cole trechos de log em issues do GitHub (o repositório é público).

### 13.2 Sentry: aviso de erro por e-mail (opcional)

O Sentry é um serviço que recebe os erros graves (respostas 5xx e exceções não
tratadas) e te manda um e-mail com o stack trace. Sem a variável `SENTRY_DSN`, ele
fica desligado e nada muda.

**Criar a conta e o projeto (uma vez só):**

1. Acesse <https://sentry.io/signup/> e crie a conta (o plano gratuito *Developer* basta para um cliente).
2. Ao criar a organização, escolha a região de dados (EU ou US; para LGPD, a EU costuma ser a escolha mais confortável).
3. Clique em **Create Project** → plataforma **NestJS** → em alertas, deixe *"Alert me on every new issue"* → nome `erp-api` → **Create Project**.
4. Na tela seguinte (ou em **Settings → Projects → erp-api → Client Keys (DSN)**), copie o **DSN**. Ele parece com `https://abc123...@o000000.ingest.us.sentry.io/0000000`.
5. Em **Settings → Security & Privacy** da organização, confira que *Data Scrubber*, *Use Default Scrubbers* e *Prevent Storing of IP Addresses* estão **ligados**. É uma segunda camada de proteção: a API já remove corpo, cookies, tokens e query string antes de enviar.
6. **Não** instale o "wizard" (`npx @sentry/wizard`) nem cole o código de exemplo que o site sugere: o ERP já está configurado em `src/instrument.ts`.

**Ligar no PC do cliente:**

1. Abra `C:\ERP-Deploy\.env.prod` e acrescente a linha `SENTRY_DSN=<o DSN copiado>`.
2. Recrie o container da API (só `restart` **não** relê o `.env.prod`):
   ```powershell
   cd C:\ERP-Deploy
   docker compose -f docker-compose.prod.yml up -d api
   ```
3. Confira se a última linha do boot diz `(Sentry ativo)`:
   ```powershell
   docker logs erp_api --since 5m | Select-String "escutando"
   ```

O Sentry identifica cada erro com `environment` (= `SEFAZ_ENV`, ex.: `producao`) e
`release` (= `erp-api@<versão do package.json>`). Por isso, **suba a versão no
`package.json` a cada entrega**: assim você sabe em qual versão o erro apareceu.

> O DSN não é uma senha forte (só permite *enviar* erros), mas mesmo assim fica só
> no `.env.prod` do cliente, nunca no repositório.

### 13.3 Tailscale: uma "rede privada" entre o seu notebook e o PC do cliente

O Tailscale cria uma rede privada criptografada (chamada *tailnet*) entre os seus
aparelhos, sem abrir porta no roteador do cliente. Cada máquina ganha um nome
(ex.: `tapajos-erp`) e um IP `100.x.y.z` que só os aparelhos do seu tailnet enxergam.

**Passo 1: criar a conta (no notebook)**

1. Acesse <https://login.tailscale.com/start> e entre com uma conta Google, Microsoft ou GitHub. O plano gratuito *Personal* é suficiente.
2. **Ative a verificação em duas etapas (2FA)** nessa conta Google/Microsoft/GitHub: quem entrar nela entra no PC do cliente.

**Passo 2: instalar no notebook do desenvolvedor**

1. Baixe em <https://tailscale.com/download/windows> e instale (próximo → próximo).
2. Clique no ícone do Tailscale perto do relógio → **Log in** → entre com a conta do Passo 1.

**Passo 3: instalar no PC do cliente** (precisa ser feito uma vez, presencialmente ou com o cliente te ajudando por telefone/AnyDesk)

1. Mesmo instalador: <https://tailscale.com/download/windows>.
2. **Log in** com **a mesma conta** do Passo 1. Assim os dois aparelhos caem no mesmo tailnet.
3. Ícone do Tailscale → **Preferences** → marque **Run unattended**. Sem isso, o Tailscale só conecta quando alguém está logado no Windows.
4. Em **Configurações do Windows → Sistema → Energia**, deixe "Suspender" em **Nunca** quando ligado na tomada. PC dormindo = PC inacessível.

**Passo 4: ajustar no painel** (<https://login.tailscale.com/admin/machines>)

1. Na linha do PC do cliente: **⋯ → Edit machine name** → `tapajos-erp`.
2. **⋯ → Disable key expiry**. Por padrão a máquina "desloga" a cada 180 dias, e você perderia o acesso justamente quando precisasse.
3. Na aba **DNS**, confira que **MagicDNS** está ligado (é o que permite usar o nome `tapajos-erp` em vez do IP).

**Passo 5: testar (no notebook)**

```powershell
tailscale status
```

```powershell
ping tapajos-erp
```

Se o `ping` responder, a rede está funcionando.

### 13.4 Entrar no PC do cliente

Há duas formas. A **B (SSH)** é a mais leve e funciona em qualquer Windows.

**Opção A: Área de Trabalho Remota (você vê a tela do cliente)**

> Só funciona se o PC do cliente for **Windows Pro** (veja em *Configurações → Sistema → Sobre → Edição*).
> No Windows **Home** não há servidor de Área de Trabalho Remota: use a opção B.
> Atenção: ao conectar, a sessão do usuário que está no PC é **bloqueada**. Combine com o cliente antes.

1. No PC do cliente: *Configurações → Sistema → Área de Trabalho Remota → Ativar*.
2. O usuário do Windows precisa ter **senha** (forte).
3. No notebook: tecla Windows → digite `mstsc` → em *Computador*, coloque `tapajos-erp` → Conectar → usuário e senha do Windows do cliente.

**Opção B: SSH (só linha de comando, não atrapalha quem está usando o PC)**

No PC do cliente, abra o **PowerShell como Administrador** e rode, um por vez:

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
```

```powershell
Start-Service sshd
```

```powershell
Set-Service -Name sshd -StartupType Automatic
```

No notebook, conecte usando o usuário do Windows do cliente:

```powershell
ssh usuario@tapajos-erp
```

Para não digitar senha toda vez (e mais seguro), use chave SSH:

1. No notebook: `ssh-keygen -t ed25519` (aperte Enter em tudo). A chave pública fica em `C:\Users\<você>\.ssh\id_ed25519.pub`.
2. Se o usuário do cliente for **administrador** do Windows, cole o conteúdo desse `.pub` no PC do cliente em `C:\ProgramData\ssh\administrators_authorized_keys` (para usuário comum: `C:\Users\<usuario>\.ssh\authorized_keys`).

### 13.5 Ler os logs remotamente

Depois de entrar por SSH ou Área de Trabalho Remota, no PowerShell do PC do cliente:

```powershell
# Listar os arquivos de log (um por dia)
Get-ChildItem C:\ERP-Deploy\logs

# Últimas 50 linhas do log de hoje
Get-Content "C:\ERP-Deploy\logs\api-$(Get-Date -Format yyyy-MM-dd).log" -Tail 50

# Só os erros do log de hoje
Select-String -Path "C:\ERP-Deploy\logs\api-$(Get-Date -Format yyyy-MM-dd).log" -Pattern '"level":"error"'

# Acompanhar em tempo real (Ctrl+C para sair)
Get-Content "C:\ERP-Deploy\logs\api-$(Get-Date -Format yyyy-MM-dd).log" -Wait -Tail 10

# Console do container na última hora (inclui console.log e mensagens de boot)
docker logs erp_api --since 1h

# Só erros do console na última hora
docker logs erp_api --since 1h 2>&1 | Select-String "ERROR"
```

Para trazer um arquivo para o notebook (rodando **no notebook**):

```powershell
scp usuario@tapajos-erp:C:/ERP-Deploy/logs/api-2026-11-23.log .
```

Arquivos antigos (`.log.gz`): abra com o 7-Zip, ou no Git Bash use `zcat api-2026-11-01.log.gz | less`.

**Roteiro rápido quando o cliente reportar um problema:**

1. Pergunte **o horário aproximado** e **o que ele estava fazendo** (ex.: "emitindo NF").
2. Abra o log do dia e procure linhas com `"level":"error"` perto desse horário (lembre: o log está em UTC, ou seja, 14h de Brasília = `17:` no log).
3. A linha `HTTP` mostra a rota e a mensagem; a linha de erro logo antes ou depois (outro `context`, ex.: `NfeEmitService`) costuma ter o stack trace.
4. Se o Sentry estiver ligado, o mesmo erro estará lá com o stack trace completo e a versão.

### 13.6 Recomendações de segurança

1. **Fechar a porta 5432 do Postgres (importante).** Hoje o `docker-compose.prod.yml`
   publica o banco na rede local (`ports: - "5432:5432"`) com usuário e senha `postgres`.
   Qualquer computador da rede do cliente consegue ler e apagar o banco. A API **não
   precisa** dessa porta: ela fala com o banco pela rede interna do Docker (`db:5432`).
   Sugestão de mudança no serviço `db` do `docker-compose.prod.yml`:
   ```yaml
   # antes
       ports:
         - "5432:5432"
   # depois: remover as duas linhas acima, ou, se precisar acessar do próprio PC:
       ports:
         - "127.0.0.1:5432:5432"
   ```
   Para consultar o banco depois disso, entre por SSH e use
   `docker exec -it erp_db psql -U postgres -d erp`. Num segundo momento, troque também a
   senha padrão `postgres`.
   *(Aplicada no compose do pipeline novo, `deploy/cliente/docker-compose.prod.yml`, com
   `127.0.0.1:5432:5432` — vale a partir da primeira atualização pelo modelo novo; ver seção 14.)*
2. **Não use** os recursos *Tailscale Funnel* / *Serve*: eles publicam serviços na internet.
3. **2FA** na conta usada no Tailscale e no Sentry.
4. **Senha forte** no usuário do Windows do cliente (exigida pela Área de Trabalho Remota) e, no SSH, prefira chave.
5. **Autorização do cliente:** combine por escrito (e-mail serve) que você tem acesso
   remoto para suporte e que os logs ficam no PC dele. Isso é boa prática de LGPD.
6. **Revogar acesso:** se o notebook for perdido ou roubado, remova-o em
   <https://login.tailscale.com/admin/machines> (**⋯ → Remove**).

---

## 14. Atualização do Cliente: Pipeline de Versões

Substitui o processo antigo (build local `--no-cache` → `erp-deploy.tar` de vários GB →
pendrive → `docker load`). O `.tar` continua existindo, mas só como **plano B**.

### 14.1 Visão geral

```
Notebook (dev)                 GitHub                              PC do cliente
──────────────                 ──────                              ─────────────
git tag v1.1.0     ──push──▶   Actions constrói as imagens         ATUALIZAR_ERP.bat
git push origin v1.1.0         e publica no ghcr.io:          ◀──  1. backup do banco
                                 erp-api:v1.1.0, erp-web:v1.1.0     2. baixa só o que mudou
                               + Release v1.1.0 (lista de commits)  3. sobe a versão nova
                                                                    4. confere o /health
```

- **Por que é melhor:** ninguém constrói imagem no notebook; o download no cliente é de
  dezenas de MB (só as camadas que mudaram), não GB; cada versão tem nome (`v1.1.0`), então
  dá para saber o que está rodando e **voltar** para a anterior com um comando.
- **Versão visível:** na barra lateral do sistema e em `http://localhost:3000/health`
  (campo `version`).
- **Migrações** do banco continuam automáticas (`entrypoint.sh`). Correções de dados
  também devem virar migração — nada de script SQL manual.

Arquivos envolvidos:

| Arquivo | Onde roda | Para quê |
|---|---|---|
| `.github/workflows/publicar-versao.yml` | GitHub | Constrói e publica as imagens a cada tag `vX.Y.Z` |
| `deploy/cliente/docker-compose.prod.yml` | Cliente | Sistema em produção usando as imagens versionadas |
| `deploy/cliente/ATUALIZAR_ERP.bat` + `atualizar-erp.ps1` | Cliente | Atualizar / voltar versão |
| `deploy/cliente/backup-banco.ps1` | Cliente | Backup diário (substitui `backup-diario.ps1`) |
| `deploy/cliente/corrigir-backup-antigo.ps1` | Cliente | Recupera acentos de backups antigos |
| `deploy/gerar-pacote.ps1` | Notebook | Plano B: gera o `.tar` de uma versão |

### 14.2 Publicar uma versão (no notebook)

1. Tudo commitado e enviado (`git push`).
2. Escolha o número — `vMAIOR.MENOR.CORREÇÃO`:
   - `v1.1.0 → v1.1.1`: só correções;
   - `v1.1.0 → v1.2.0`: funcionalidade nova;
   - `v1.x → v2.0.0`: mudança grande/incompatível.
3. Crie e envie a tag:
   ```powershell
   git tag v1.1.0
   git push origin v1.1.0
   ```
4. Acompanhe em **GitHub → Actions → "Publicar versão"** (~5 min na primeira vez; depois,
   com cache, menos). Verde = imagens publicadas e Release criada.

> Errou algo numa versão já publicada? **Não reaproveite o número**: publique a seguinte
> (`v1.1.1`). Versão publicada nunca muda — é isso que torna o "voltar" confiável.

### 14.3 Visibilidade das imagens (uma vez)

Na primeira publicação o GitHub cria os pacotes `erp-api` e `erp-web`
(**github.com/Leitekaique?tab=packages**). Escolha uma opção:

- **Públicos (mais simples):** em cada pacote → **Package settings → Change visibility →
  Public**. O cliente baixa sem senha. As imagens não têm senhas nem dados (eles ficam no
  `.env.prod` e no banco, no PC do cliente) — só o código, que já é público no repositório.
- **Privados:** crie um token em **GitHub → Settings → Developer settings → Personal access
  tokens (classic)** só com `read:packages`, e no PC do cliente rode **uma vez**:
  ```powershell
  docker login ghcr.io -u Leitekaique
  # senha: cole o token
  ```

### 14.4 Migração única do cliente para o modelo novo

Faça com o sistema fora de uso (ex.: fim do expediente). Pode ser remoto, via Tailscale (seção 13).

1. Publique a primeira versão (14.2) — por exemplo `v1.1.0`.
2. No PC do cliente, **guarde** o compose antigo:
   `Rename-Item C:\ERP-Deploy\docker-compose.prod.yml docker-compose.prod.antigo.yml`
3. Copie para `C:\ERP-Deploy` os arquivos de `deploy\cliente\` do repositório:
   `docker-compose.prod.yml`, `ATUALIZAR_ERP.bat`, `atualizar-erp.ps1`, `backup-banco.ps1`,
   `corrigir-backup-antigo.ps1`. O `.env.prod`, `certs\` e `uploads\` **ficam como estão**.
4. Dê dois cliques em **`ATUALIZAR_ERP.bat`** (ou `ATUALIZAR_ERP.bat -Versao v1.1.0`).
   O script confere que o banco atual (`erp-deploy_postgres_data`) existe, faz backup,
   baixa as imagens e sobe. Ao final mostra **"ERP Tapajos atualizado para v1.1.0"**.
5. No **Agendador de Tarefas**, troque a ação do backup diário para:
   `powershell.exe -ExecutionPolicy Bypass -File "C:\ERP-Deploy\backup-banco.ps1"`
6. Depois da primeira atualização (já com as correções de nov/2026):
   - **Emissão NF-e → "Corrigir XMLs (protocolo)"**;
   - **Faturamento → "Verificar NFs canceladas"**;
   - diagnóstico do estoque (copie `scripts\diagnostico-estoque.sql` do repositório para
     `C:\ERP-Deploy`; o arquivo vai e volta por `docker cp` para não estragar acentos):
     ```powershell
     docker cp .\diagnostico-estoque.sql erp_db:/tmp/diag.sql
     docker exec erp_db psql -U postgres -d erp -f /tmp/diag.sql -o /tmp/diagnostico.txt
     docker cp erp_db:/tmp/diagnostico.txt .\diagnostico.txt
     ```
     e envie o `diagnostico.txt` para análise.

> **Se o script parar dizendo que o volume do banco não existe:** não use
> `-PrimeiraInstalacao`! Isso criaria um banco vazio. Rode `docker volume ls` e veja o nome
> do volume atual; o projeto antigo pode ter outro nome de pasta. Ajuste antes de seguir.

### 14.5 Dia a dia: atualizar, voltar, plano B

```powershell
ATUALIZAR_ERP.bat                     # última versão publicada
ATUALIZAR_ERP.bat -Versao v1.2.0      # versão específica
ATUALIZAR_ERP.bat -Versao v1.1.0      # VOLTAR (a versão anterior fica em versao-anterior.txt)
```

- Cada execução gera `backups\antes-<versão>-<data>.sql` e o registro
  `logs\atualizacao-<data>.log`.
- **Voltar versão** troca o programa, não o banco. Se a versão nova tiver migração de banco,
  ao voltar o banco continua migrado — em geral funciona (migrações só acrescentam), mas se
  a versão anterior der erro, restaure o backup `antes-<versão>` (seção 11).
- Se a API não responder em 3 minutos, o script mostra o log e o comando exato para voltar.

**Plano B — sem GitHub/internet no cliente:**

1. No notebook:
   ```powershell
   powershell.exe -ExecutionPolicy Bypass -File deploy\gerar-pacote.ps1 -Versao v1.2.0
   # GitHub fora do ar? acrescente -ConstruirLocal (constrói aqui, ~10 min)
   ```
   Gera `deploy\pacotes\erp-v1.2.0.tar`.
2. Leve o `.tar` para `C:\ERP-Deploy` (pendrive ou rede) e rode:
   `ATUALIZAR_ERP.bat -Versao v1.2.0 -Pacote C:\ERP-Deploy\erp-v1.2.0.tar`

### 14.6 Backups antigos com acentos quebrados

Até nov/2026, `backup-diario.ps1` e `backup-semanal-gdrive.ps1` gravavam o dump pelo pipe do
PowerShell 5.1, que **corrompe os acentos** (`IMPORTAÇÃO` → `IMPORTA├ç├âO`). Os dados não se
perderam — dá para reverter sem perda:

```powershell
powershell.exe -ExecutionPolicy Bypass -File corrigir-backup-antigo.ps1 -Arquivo backups\erp-backup-2026-11-20_12-00.sql
# gera erp-backup-2026-11-20_12-00.corrigido.sql — use ESTE para restaurar
```

Os scripts novos (`backup-banco.ps1` e a etapa de backup do `ATUALIZAR_ERP.bat`) geram o
arquivo dentro do container e copiam com `docker cp`, sem passar pelo pipe.

---

*Documento gerado em 2026-03-28. Atualizar sempre que houver mudanças significativas na arquitetura ou nos procedimentos de deploy.*
