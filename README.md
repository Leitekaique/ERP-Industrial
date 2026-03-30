# ERP Tapajós — Sistema de Gestão para Indústria Têxtil

> Sistema ERP completo desenvolvido sob medida para uma empresa de beneficiamento e peletização têxtil no interior de São Paulo. Substitui processos manuais em planilhas e um ERP legado, centralizando emissão de NF-e, controle de estoque, faturamento e financeiro em uma única plataforma web.

---

## Contexto do Projeto

A empresa opera com um fluxo produtivo específico: recebe malha crua de clientes (remessa para industrialização), realiza o processo de beneficiamento/peletização e devolve o produto acabado junto com a cobrança pelos serviços e insumos aplicados. Esse fluxo gera NF-es com múltiplos CFOPs simultâneos (retorno + serviço + insumo), cobrança variável por cliente e controle rigoroso de estoque por lote.

O projeto foi idealizado, especificado e desenvolvido do zero ao longo de aproximadamente 3 meses de desenvolvimento iterativo, com entregas e testes contínuos junto ao usuário final.

---

## Funcionalidades

### 📦 Estoque
- Controle por lote (`StockLot`), empresa de origem e processo produtivo
- Entradas manuais e automáticas (via importação de XML de NF-e)
- Saídas com ou sem geração de cobrança
- Conversão de unidades com arredondamento configurável
- Agrupamento visual por empresa / processo / NF na interface

### 🧾 NF-e (Emissão)
- Geração de XML NF-e 4.00 assinado, conforme layout SEFAZ
- Suporte a múltiplos CFOPs por nota (5902, 5124, 5101, 6902...)
- Emissão via estoque (baixa automática) ou via formulário livre
- DANFE em PDF (gerado internamente, sem dependência externa)
- Envio automático de XML + DANFE por e-mail ao cliente e ao escritório contábil
- Cancelamento de NF e CC-e (Carta de Correção)
- Importação de XML histórico para popular dashboard
- Integração com SEFAZ-SP (modos: simulador / homologação / produção)
- Cálculo automático de tributos aproximados IBPT (Lei 12.741/2012)
- Crédito ICMS Simples Nacional nos dados adicionais (art. 23, LC 123/2006)

### 🏭 NF-e (Entrada)
- Importação de XML de NF de fornecedores
- Extração automática de produto, CFOP, NCM, CEST, impostos
- Geração automática de conta a pagar com base nas duplicatas do XML

### 💰 Financeiro
- **A Receber:** acúmulo automático por cliente (dia 15/dia 20) ou por NF individual
- **A Pagar:** categorização, histórico de pagamentos, data de baixa
- **Faturamento:** geração de fatura PDF (boleto/duplicata), envio por e-mail, controle de status
- Histórico financeiro unificado (recebíveis + pagáveis + faturas)
- Dashboard com KPIs: faturamento mensal, top clientes, fluxo de caixa, contas a vencer

### 👤 Cadastros
- Clientes, fornecedores e transportadoras
- Empresas (multi-tenant), armazéns e processos produtivos
- Catálogo de produtos com preço, NCM, CEST, CSOSN configuráveis

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| **Backend** | NestJS (Node.js + TypeScript) |
| **ORM** | Prisma + PostgreSQL 15 |
| **Frontend** | React 18 + TypeScript + Vite |
| **Estilo** | Tailwind CSS |
| **Geração de PDF** | PDFKit (DANFE e Fatura) |
| **Geração de XML** | xmlbuilder2 (NF-e 4.00) |
| **Assinatura XML** | node-forge (certificado A1) |
| **E-mail** | Nodemailer + Gmail SMTP |
| **Autenticação** | JWT (NestJS Guards) |
| **Infraestrutura** | Docker + Docker Compose |
| **Agendamento** | NestJS Schedule (cron jobs) |

---

## Arquitetura

```
erp/
├── src/                        # Backend (NestJS)
│   ├── modules/
│   │   ├── nfe-emit/           # Emissão NF-e: XML, DANFE, SEFAZ, e-mail
│   │   ├── nfe-import/         # Importação XML NF-e entrada
│   │   ├── billing/            # Faturamento e duplicatas
│   │   ├── finance/            # A receber e a pagar
│   │   ├── stock/              # Estoque e movimentações
│   │   ├── dashboard/          # KPIs e gráficos
│   │   └── ...
│   └── prisma/                 # Schema e migrations
├── web/                        # Frontend (React + Vite)
│   └── src/
│       ├── pages/              # Telas: NF-e, estoque, financeiro, dashboard...
│       ├── components/         # Componentes reutilizáveis
│       └── lib/                # Hooks, API client, utilitários
├── docker-compose.yml          # Orquestra API + banco
├── Dockerfile                  # Build da API
└── .env.example                # Variáveis de ambiente necessárias
```

---

## Como rodar localmente

### Pré-requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/erp-tapajos.git
cd erp-tapajos

# 2. Configure as variáveis de ambiente
cp .env.example .env.dev
# Edite .env.dev com suas credenciais (SMTP, JWT secret, etc.)

# 3. Suba os containers (API + banco)
docker compose up --build

# 4. Acesse o frontend (em outra aba do terminal)
cd web
npm install
npm run dev
```

Após inicializar:
- **Frontend:** http://localhost:5173
- **API:** http://localhost:3000
- **Prisma Studio:** http://localhost:5555

### Login padrão
```
Usuário: admin
Senha: (configure no seed ou diretamente no banco)
```

---

## Variáveis de Ambiente

Copie `.env.example` para `.env.dev` e preencha:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | String de conexão PostgreSQL |
| `JWT_SECRET` | Chave secreta para tokens JWT |
| `SEFAZ_ENV` | `simulator` / `homologacao` / `producao` |
| `CERT_PASSWORD` | Senha do certificado A1 (produção) |
| `SMTP_*` | Configurações de e-mail |
| `IBPT_TOKEN` | Token API IBPT (opcional, usa padrão sem ele) |

---

## Conformidade Fiscal

O sistema foi desenvolvido para empresas optantes pelo **Simples Nacional (CRT=1)** no segmento de **industrialização por encomenda** (beneficiamento têxtil), atendendo:

- NF-e layout 4.00 (SEFAZ-SP)
- CSOSN 900 com cálculo de crédito ICMS (pCredSN/vCredICMSSN)
- PIS/COFINS CST 08 (não tributado — correto para beneficiamento)
- Tributos aproximados IBPT (Lei 12.741/2012) com integração à API iws.ibpt.org.br
- Seção `<cobr>` com fatura e duplicatas geradas a partir do prazo do cliente
- Dados adicionais com crédito ICMS (art. 23, LC 123/2006) e declaração de devolução

---

## Sobre o Desenvolvimento

Este projeto foi desenvolvido de forma independente como solução sob medida, passando por múltiplos ciclos de especificação, desenvolvimento e testes com o usuário final. O processo incluiu:

- Mapeamento completo do fluxo operacional da empresa
- Definição de regras de negócio específicas (CFOPs, prazos de cobrança, acúmulo por cliente)
- Desenvolvimento iterativo com entregas incrementais semanais
- Testes de conformidade fiscal com análise de XMLs e DANFEs reais
- Planejamento e execução do deploy em ambiente de produção (Windows + Docker Desktop)

---

## Licença

Este repositório é público para fins de portfólio. O código não deve ser usado comercialmente sem autorização.

---

*Desenvolvido por [Kaique](https://www.linkedin.com/in/seu-perfil) — 2026*
