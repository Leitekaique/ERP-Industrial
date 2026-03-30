# PDR — ERP Tapajós
**Product Design & Requirements Document**
**Versão**: 1.0 | **Data**: Março 2026 | **Status**: Em execução

---

## 1. Visão Geral

### 1.1 O Produto
Sistema ERP desktop/web para a empresa **PELETIZACAO TEXTIL TAPAJOS LTDA - ME** (Tapajós), cobrindo:
- Gestão de estoque (próprio + terceiros)
- Emissão de NF-e (integrada ao SEFAZ-SP)
- Contas a receber e a pagar
- Faturamento mensal automatizado (duplicata)
- Controle financeiro básico
- Cadastros (clientes, fornecedores, transportadoras, produtos)

### 1.2 Substituição de Sistema
Substitui o **SKYHAND 5.02** — o sistema legado atual da empresa.

### 1.3 Usuários do Sistema
| Role | Acesso |
|------|--------|
| **Admin** | Acesso total — NF-e, financeiro, certificado digital, configurações gerais |
| **Manager** | Acesso operacional — NF-e, estoque, clientes — sem config. financeira/certificado |

---

## 2. Empresa e Contexto de Negócio

### 2.1 Dados da Empresa
- **CNPJ**: 05.114.479/0001-00
- **IE**: 606203479118
- **CRT**: 1 (Simples Nacional)
- **Endereço**: Santa Bárbara d'Oeste - SP
- **Banco**: Itaú, Ag. 1578, CC 15996-2

### 2.2 Operação Principal
A Tapajós presta **serviços de processamento têxtil** (dublagem, laminação, refile):
1. Cliente envia tecido → entra no estoque como `third_party_in`
2. Tapajós processa — pode aplicar insumos próprios
3. NF-e de saída emitida (serviço + devolução simbólica do tecido)
4. Conta a receber aberta → agregada em duplicata mensal

### 2.3 CFOPs Utilizados
| CFOP | Descrição | Contexto |
|------|-----------|----------|
| 5124 + 5902 | Serviço mão-de-obra + insumos aplicados + ret. simbólica tecido | Mais comum (interestadual: 6124+6902) |
| 5101 / 6101 | Venda direta de produto (sem ser dentro de serviço) | Venda de produto |
| 5911 | Remessa gratuita / amostras | Sem valor comercial |
| 6915 | Remessa para conserto/reparo | Envio para terceiros |
| 5901 / 6901 | Remessa de industrialização (entrada) | NÃO gera payable |

---

## 3. Arquitetura Técnica

### 3.1 Stack
| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS 10.3.10 + TypeScript |
| ORM | Prisma 6.19.0 |
| Banco de dados | PostgreSQL 15 |
| Runtime | Node.js 22 |
| Frontend | React 18.3.1 + Vite 5.4 |
| Roteamento | React Router v6 |
| Estado servidor | TanStack React Query 5 |
| Estilos | Tailwind CSS 3.4 |
| Validação | Zod |
| Ícones | Lucide React |
| Infra | Docker + Docker Compose |
| NF-e | NF-e v4.00, Mod 55, Série 1 |
| Certificado | A1 (PKCS#12 / node-forge) |
| SEFAZ | Ambiente SP (homologação → produção) |

### 3.2 Multi-tenancy
Hierarquia: `Tenant → Company → Customer`
Tenant injetado via middleware em todas as requisições.

### 3.3 Estoque
Três tipos de propriedade:
- `own` — insumos Tapajós
- `third_party_in` — tecido de cliente (entrada)
- `third_party_out` — tecido de cliente (saída / devolvido)

---

## 4. Módulos do Sistema

### 4.1 Estado Atual (março 2026)

| Módulo | Status | Observação |
|--------|--------|-----------|
| Tenant / Company | ✅ Completo | — |
| Customer (Clientes) | 🟡 Quase | Falta campo payment_term_day |
| Supplier (Fornecedores) | ✅ Completo | — |
| Product | ✅ Completo | — |
| CatalogProduct | ✅ Completo | — |
| Warehouse | ✅ Completo | — |
| StockMovement / StockLot | ✅ Completo | — |
| Process / ProcessHistory | ✅ Completo | — |
| Transporter | 🟡 Quase | Backend existe, falta front |
| NF-e Emit | 🟡 Em desenvolvimento | Simulador OK; SEFAZ real pendente |
| NF-e Import | ✅ Completo | — |
| NF-e Events | ✅ Completo | — |
| Receivables | 🔴 Pendente | Módulo existe no schema, não integrado |
| Payables | 🔴 Pendente | Módulo existe no schema, não integrado |
| Billing / Duplicata | 🔴 Pendente | Lógica de agregação mensal não implementada |
| Auth / Usuários | 🔴 Pendente | Nenhuma autenticação implementada |
| Dashboard | 🔴 Pendente | Não existe |
| WorkOrders | ❌ Remover | Módulo morto — nunca usado |

### 4.2 Módulos Pendentes — Especificação Detalhada

#### 4.2.1 Autenticação (Auth)
- JWT-based (access token + refresh token)
- Dois roles: `ADMIN` e `MANAGER`
- Login por email + senha
- Middleware que injeta usuário autenticado em todas as rotas
- Guard de role por endpoint
- Acesso do Admin: tudo
- Acesso do Manager: NF-e, estoque, clientes, fornecedores — bloqueado: configurações financeiras, certificado, usuários

#### 4.2.2 Customer — Termos de Pagamento
- Campo `payment_term_day: Int` no modelo Customer (ex: dia 10, 15, 20...)
- Campo `accountant_email: String?` — email do contador para receber notificações
- Validação: dia entre 1 e 28 (evitar problemas com fevereiro)

#### 4.2.3 NF-e Emit — Integração SEFAZ-SP
- Fase 1 (feita): Simulador local — gera XML, assina, valida estrutura
- Fase 2 (pendente): Conexão real com SEFAZ-SP
  - Ambiente homologação primeiro → validação → produção
  - Endpoint: NfeAutorizacao4 (SOAP)
  - Tratamento de retorno: cStat 100 (autorizado), 150 (autorizado fora prazo), 4xx (rejeitado)
  - Salvar XML autorizado + chave de acesso + protocolo
  - Geração de PDF DANFE com logo Tapajós no cabeçalho (canto superior esquerdo)
  - Cancelamento: NfeCancelamento4 (prazo: até 24h após emissão)
  - Inutilização de numeração

#### 4.2.4 Receivables (Contas a Receber)
- Criado automaticamente quando NF-e de saída é autorizada
- Campos: customer_id, nfe_id, amount, due_date, status (pending/partial/paid), notes
- Due date calculada com base no `payment_term_day` do cliente
- Listagem com filtros: por cliente, por status, por período
- Ação "Registrar Pagamento" → abre modal com valor recebido + data + forma

#### 4.2.5 Payables (Contas a Pagar)
- Criado quando NF-e de entrada é de compra (não remessa)
- Lógica por CFOP:
  - 5901/6901 (remessa industrialização) → **não cria payable**
  - Compra de insumos → **cria payable + movimenta estoque**
  - Compra escritório/manutenção → **cria payable apenas**
- Campos: supplier_id, nfe_id, amount, due_date, status, notes
- Ação "Registrar Pagamento"

#### 4.2.6 Billing / Duplicata Mensal
**Regra de negócio central:**
- Ao final de cada mês (ou sob demanda): agrupar todas as NFs autorizadas de um cliente no mês em uma única duplicata
- Valor: soma dos totais das NFs
- Vencimento: dia `payment_term_day` do cliente no mês seguinte
- Ao criar duplicata: enviar email para cliente + contador com resumo das NFs + valor + vencimento
- Ao vencer (job diário): verificar duplicatas vencidas → enviar lembrete
- Ao registrar pagamento: enviar email de confirmação

**Modelo de email:**
- Remetente configurável (SMTP da empresa)
- Templates: criação de duplicata, lembrete de vencimento, confirmação de pagamento

#### 4.2.7 Dashboard
KPIs principais (Admin):
- Faturamento do mês atual vs. mês anterior
- NFs emitidas no mês
- Duplicatas em aberto (valor total)
- Duplicatas vencidas (alerta)
- Top 5 clientes por faturamento
- Estoque de insumos (alertas de baixo estoque)

KPIs Manager (reduzido):
- NFs emitidas no mês
- Estoque disponível

---

## 5. Regras de Negócio Críticas

### 5.1 NF-e e Financeiro
- Toda NF-e de saída autorizada → **obrigatoriamente cria Receivable**
- NF-e de entrada tipo remessa (5901/6901) → **não cria Payable**
- NF-e de entrada tipo compra → **cria Payable**

### 5.2 Duplicata
- Uma duplicata por cliente por mês
- Valor = soma das NFs autorizadas no período
- Vencimento = dia configurado no cadastro do cliente, no mês seguinte
- Emails obrigatórios: criação + vencimento + pagamento

### 5.3 Certificado Digital
- Tipo A1 (arquivo .pfx / .p12)
- Usado para assinar XML das NF-e
- Armazenado de forma segura no servidor (não exposto via API)
- Configurável pelo Admin

### 5.4 Retenção de Documentos Fiscais
- XMLs de NF-e autorizadas devem ser armazenados por **mínimo 5 anos** (IN RFB 1.774/2017)
- Estratégia: salvar XML em disco local (pasta configurável) + caminho no banco
- Backup periódico recomendado

### 5.5 Estoque — Seleção para NF-e
- Ao emitir NF-e de saída, o sistema deve apresentar os lotes disponíveis para seleção
- Para serviços (5124): o tecido do cliente (third_party_in) é listado
- Para vendas de insumo (5101): o estoque próprio (own) é listado
- Confirmação após emissão move o lote para `third_party_out` ou debita estoque próprio

---

## 6. Requisitos de Interface

### 6.1 Layout Geral
- Design limpo, profissional, consistente
- Paleta de cores: definir identidade visual Tapajós
- Logo Tapajós: presente no cabeçalho do sistema e no PDF DANFE
- Responsivo suficiente para uso em desktop (1366x768 mínimo)
- Sidebar navegável com todos os módulos

### 6.2 Padrões de UX
- Formulários com validação em tempo real (Zod)
- Feedback visual em todas as ações (toast notifications)
- Modais de confirmação para ações destrutivas
- Loading states em todas as consultas assíncronas
- Estados vazios com mensagens úteis (não tela em branco)

### 6.3 Telas Prioritárias para Polish
1. NF-e Emit — fluxo completo (formulário → preview → emissão → DANFE)
2. Dashboard — primeira impressão do sistema
3. Clientes — listagem e cadastro
4. Contas a Receber — listagem com filtros e ações
5. Duplicatas — listagem e geração

---

## 7. Requisitos de Deploy

### 7.1 Estratégia de Deploy (Decisão Pendente)
**Opção A — Web App Local (Recomendada para simplicidade)**
- Backend NestJS + PostgreSQL rodando via Docker no PC admin
- Frontend acessado via browser em `http://localhost:3000`
- Script `.bat` / `PowerShell` para iniciar tudo com um clique
- "Instalar" = instalar Docker Desktop + rodar script de setup

**Opção B — Electron (`.exe` real)**
- Empacota o frontend React em Electron
- Backend NestJS roda como processo filho via `child_process`
- Mais complexo, mas parece "aplicativo desktop"
- Problemas: tamanho grande, atualizações complexas

**Decisão recomendada**: Opção A (mais simples, mais estável, mais fácil de manter)

### 7.2 Requisitos de Instalação
- Docker Desktop instalado no PC admin
- PostgreSQL rodando via container (não instalar manualmente)
- Variáveis de ambiente em `.env` local (não commitado)
- Script de primeiro setup: cria banco, roda migrations, cria usuário admin inicial

### 7.3 Backup
- Script de backup automático do PostgreSQL (pg_dump) agendado
- Armazenar em pasta local + recomendação de backup em nuvem (OneDrive)

---

## 8. Fora do Escopo (Fase 1)

- App mobile
- Integração bancária automatizada (remessa/retorno de boletos)
- Módulo de RH / folha de pagamento
- Módulo de produção/PCP avançado
- Portal do cliente
- Integração com contabilidade (SPED/ECD)
- Multi-empresa (multi-company dentro de um tenant — futuro)

---

## 9. Definition of Done (DoD)

O projeto está concluído quando:

- [ ] Todos os módulos listados em 4.1 estão com status ✅
- [ ] NF-e emit testada e aprovada em ambiente SEFAZ-SP homologação
- [ ] NF-e emit testada e aprovada em ambiente SEFAZ-SP produção
- [ ] DANFE gerado com logo Tapajós validado visualmente
- [ ] Duplicata mensal gerando emails corretamente
- [ ] Auth implementada — login funciona, roles funcionam
- [ ] Dashboard exibindo KPIs corretos
- [ ] WorkOrders removido
- [ ] Layout de todas as telas polido e consistente
- [ ] Script de instalação testado do zero em PC limpo
- [ ] Usuário (Kaiqu) treinado e capaz de operar sem assistência

---

*Documento gerado em co-autoria com Claude Code — Março 2026*
