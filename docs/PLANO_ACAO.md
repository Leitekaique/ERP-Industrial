# Plano de Ação — ERP Tapajós
**Versão**: 1.0 | **Data**: Março 2026

---

## Visão Geral das Fases

```
FASE 1 → Fundação (Auth + Dados base)
FASE 2 → NF-e SEFAZ Real
FASE 3 → Financeiro (Receivables + Payables + Billing)
FASE 4 → Dashboard + Polish Visual
FASE 5 → Deploy + Treinamento
```

Cada fase entrega valor real e pode ser testada de ponta a ponta antes de avançar.

---

## FASE 1 — Fundação

### TAREFA 1.1 — Autenticação (Auth Module)

**Por quê primeiro?**
Todo o resto do sistema depende de saber quem está logado. Sem auth, qualquer rota é pública — em produção isso é um problema grave.

**O que fazer:**
1. Criar modelo `User` no Prisma (email, password_hash, role: ADMIN | MANAGER, company_id)
2. Instalar dependências: `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcryptjs`
3. Criar `AuthModule` com:
   - `POST /auth/login` → recebe email+senha, retorna JWT
   - `POST /auth/refresh` → renova token
   - Guard global que protege todas as rotas
   - Decorator `@Roles()` para controle por role
4. Frontend:
   - Tela de Login (email + senha)
   - Armazenar token no `localStorage`
   - Interceptor Axios/fetch que injeta `Authorization: Bearer <token>` em toda requisição
   - Redirecionar para login se token expirar (401)
   - Esconder itens de menu baseado no role do usuário logado

**Resultado esperado:** Sistema com login funcional, rotas protegidas, menu adaptado por role.

---

### TAREFA 1.2 — Customer: Payment Terms + Contador

**Por quê?**
O campo `payment_term_day` é necessário para gerar duplicatas. Sem ele, a lógica de billing não funciona.

**O que fazer:**
1. Adicionar ao modelo `Customer` no Prisma:
   - `payment_term_day: Int?` — dia de vencimento (1-28)
   - `accountant_email: String?` — email do contador para notificações
2. Rodar migration
3. Atualizar `CustomerService` — CRUD com os novos campos
4. Atualizar formulário de cadastro/edição de clientes no frontend
5. Validação Zod: `payment_term_day` entre 1 e 28

**Resultado esperado:** Todo cliente pode ter dia de vencimento e email do contador configurados.

---

### TAREFA 1.3 — Remover WorkOrders

**Por quê?**
Módulo morto = código desnecessário que confunde e polui o projeto.

**O que fazer:**
1. Deletar pasta `src/work-orders/` (backend)
2. Remover import do WorkOrdersModule em `app.module.ts`
3. Verificar se há modelo WorkOrder no schema.prisma → remover + migration
4. Deletar páginas de WorkOrders no frontend
5. Remover item do menu de navegação

**Resultado esperado:** Projeto mais limpo, sem módulos mortos.

---

## FASE 2 — NF-e SEFAZ Real

### TAREFA 2.1 — Integração SEFAZ-SP Homologação

**Por quê esta ordem?**
Só testamos SEFAZ depois de ter auth (a emissão requer usuário autenticado).

**O que fazer:**

**Backend:**
1. Configurar variáveis de ambiente:
   - `SEFAZ_ENV=homologacao` (depois mudar para `producao`)
   - `CERT_PATH` e `CERT_PASSWORD` — caminho e senha do certificado A1
   - `SEFAZ_UF=SP`
2. Carregar certificado no startup do módulo nfe-emit
3. Implementar chamada SOAP para `NfeAutorizacao4`:
   - Endpoint homologação SP: `https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx`
   - Enviar XML assinado em lote (nfeDadosMsg)
   - Parsear retorno: `cStat`, `xMotivo`, `chNFe`, `nProt`
4. Tratamento de retorno:
   - `100` ou `150` → NF autorizada → salvar XML + chave + protocolo no banco
   - `4xx` → rejeição → salvar motivo, manter NF em status `rejected`
   - Erro de comunicação → status `pending_retry`
5. Após autorização: gerar DANFE PDF (biblioteca `pdfmake` ou `puppeteer`)
   - Logo Tapajós no canto superior esquerdo do cabeçalho
   - Todos os campos obrigatórios do DANFE NF-e
6. Salvar XML em disco: `/storage/xmls/{ano}/{mes}/{chave}.xml`

**Frontend:**
1. Atualizar fluxo de emissão — mostrar status real do SEFAZ
2. Após autorização: botão "Baixar DANFE" e "Baixar XML"
3. Tela de NFs: status visual (pendente / autorizada / rejeitada / cancelada)

**Resultado esperado:** NFs emitidas com sucesso no SEFAZ-SP homologação. XMLs salvos. DANFE gerado.

---

### TAREFA 2.2 — Cancelamento e Inutilização

**O que fazer:**
1. Endpoint `POST /nfe/:id/cancel` com motivo de cancelamento
   - Prazo: apenas NFs autorizadas nas últimas 24h
   - Chama `NfeCancelamento4` no SEFAZ
   - Salvar evento de cancelamento
2. Endpoint `POST /nfe/inutilize` — inutilizar faixa de numeração
3. Frontend: botão "Cancelar" na tela de detalhe da NF (visível apenas dentro do prazo)

**Resultado esperado:** Cancelamento e inutilização funcionando conforme legislação.

---

### TAREFA 2.3 — Migração para Produção SEFAZ

**O que fazer:**
1. Trocar variável `SEFAZ_ENV=producao`
2. Trocar endpoints para produção SP:
   - `https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx`
3. Emitir NF de teste real (valor mínimo, cancelar em seguida)
4. Validar XML no portal da SEFAZ-SP e no Validador da SEFAZ nacional
5. Validar DANFE visualmente

**Resultado esperado:** NF-e funcionando em produção real.

---

## FASE 3 — Financeiro

### TAREFA 3.1 — Contas a Receber (Receivables)

**Por quê?**
Após NF-e funcionar, precisamos registrar automaticamente o que o cliente deve.

**O que fazer:**

**Backend:**
1. Revisar modelo `Receivable` no schema — garantir campos: `nfe_id`, `customer_id`, `company_id`, `amount`, `due_date`, `status` (PENDING/PARTIAL/PAID), `paid_amount`, `paid_at`, `notes`
2. Criar `ReceivablesModule` com:
   - `GET /receivables` — listagem com filtros (cliente, status, período)
   - `GET /receivables/:id` — detalhe
   - `PATCH /receivables/:id/pay` — registrar pagamento (valor + data + forma)
3. **Hook na NF-e**: após autorização SEFAZ, criar Receivable automaticamente
   - `due_date` = próximo `payment_term_day` do cliente (ou +30 dias se não configurado)

**Frontend:**
1. Tela `/receivables` — tabela com filtros
2. Modal "Registrar Pagamento" — valor, data, forma de pagamento
3. Badge de status (Pendente / Parcial / Pago) com cores

**Resultado esperado:** Ao autorizar NF, receivable criado automaticamente. Usuário consegue registrar pagamentos.

---

### TAREFA 3.2 — Contas a Pagar (Payables)

**O que fazer:**

**Backend:**
1. Revisar modelo `Payable` — campos: `nfe_id?`, `supplier_id`, `company_id`, `amount`, `due_date`, `status`, `description`, `category`
2. Criar `PayablesModule` com CRUD completo
3. Lógica de CFOP na importação de NF-e:
   - 5901/6901 → não cria payable (remessa)
   - Outros CFOPs de entrada → cria payable
4. Cadastro manual de payable (despesas sem NF)

**Frontend:**
1. Tela `/payables` — listagem com filtros
2. Formulário de cadastro manual
3. Modal de pagamento

**Resultado esperado:** Todas as obrigações financeiras registradas e controladas.

---

### TAREFA 3.3 — Billing (Duplicata Mensal)

**Esta é a regra de negócio mais complexa do sistema.**

**O que fazer:**

**Backend:**
1. Criar modelo `Invoice` (duplicata): `customer_id`, `company_id`, `reference_month`, `reference_year`, `amount`, `due_date`, `status`, `nfe_ids[]`, `paid_at`
2. Endpoint `POST /invoices/generate` — gera duplicatas do mês:
   - Busca todas NFs autorizadas do mês por cliente
   - Agrupa por cliente
   - Cria um Invoice por cliente (se ainda não existir para o mês)
   - `due_date` = `payment_term_day` do cliente no mês seguinte
3. Endpoint `PATCH /invoices/:id/pay` — registrar pagamento
4. Job agendado (cron): verificar diariamente duplicatas vencidas → disparar lembrete por email
5. Configurar nodemailer (SMTP): templates de email para:
   - Criação de duplicata (resumo das NFs + valor + vencimento)
   - Lembrete de vencimento
   - Confirmação de pagamento

**Frontend:**
1. Tela `/invoices` — listagem de duplicatas por mês
2. Botão "Gerar Duplicatas do Mês"
3. Modal de pagamento
4. Visualização das NFs que compõem a duplicata

**Resultado esperado:** Duplicata mensal gerada automaticamente, emails enviados em cada evento.

---

## FASE 4 — Dashboard + Polish Visual

### TAREFA 4.1 — Dashboard

**O que fazer:**

**Backend:**
- `GET /dashboard/summary` → retorna:
  - Faturamento mês atual vs. anterior (soma das NFs autorizadas)
  - NFs emitidas no mês (count)
  - Duplicatas em aberto (valor total)
  - Duplicatas vencidas (count + valor)
  - Top 5 clientes por faturamento no mês

**Frontend:**
1. Tela `/dashboard` como página inicial pós-login
2. Cards de KPIs com ícones (Lucide React)
3. Gráfico simples de faturamento (biblioteca `recharts` — já popular com React)
4. Lista de duplicatas vencidas com alerta visual
5. Versão reduzida para Manager (sem dados financeiros detalhados)

**Resultado esperado:** Primeira tela do sistema mostra resumo executivo da operação.

---

### TAREFA 4.2 — Polish Visual (Layout)

**O que fazer:**
1. Definir paleta de cores consistente (CSS variables no Tailwind config)
2. Componentizar elementos repetidos: TableHeader, StatusBadge, PageHeader, FormSection
3. Revisar todas as telas — aplicar padrões consistentes de:
   - Espaçamento (padding/margin)
   - Tipografia (tamanhos, pesos)
   - Cores de status (verde/amarelo/vermelho)
   - Loading states
   - Empty states
4. Adicionar logo Tapajós no sidebar/header do sistema
5. Revisar formulários — garantir que todos têm feedback de erro claro

**Telas prioritárias:**
1. Login
2. Dashboard
3. NF-e Emit (fluxo mais usado)
4. Contas a Receber
5. Clientes

**Resultado esperado:** Sistema com aparência profissional e consistente.

---

## FASE 5 — Deploy + Treinamento

### TAREFA 5.1 — Estratégia de Deploy

**Decisão**: Opção A — Web App Local via Docker

**Por quê esta opção?**
- Mais simples de instalar, atualizar e manter
- Docker Desktop já é uma dependência do projeto
- Browser como interface evita problemas de empacotamento Electron
- Funciona no mesmo PC admin sem complicação
- Atualizações = `git pull` + `docker compose up --build`

**O que fazer:**
1. Criar `docker-compose.prod.yml` otimizado
2. Criar script `start.bat` (Windows) — inicia Docker + containers com um duplo-clique
3. Criar script `setup.bat` — primeiro setup: verifica Docker, cria `.env`, roda migrations, cria usuário admin
4. Criar script `backup.bat` — faz `pg_dump` para pasta local `C:\ERP\backups\`
5. Criar `README_DEPLOY.md` — guia passo a passo para o usuário

**Resultado esperado:** Instalação do zero em PC novo possível sem conhecimento técnico.

---

### TAREFA 5.2 — Treinamento e Handoff

**O que fazer:**
1. Testar instalação do zero em ambiente limpo
2. Documentar procedimentos operacionais:
   - Como emitir uma NF
   - Como gerar duplicata do mês
   - Como registrar pagamento
   - Como fazer backup manual
3. Treinamento ao vivo com Kaiqu:
   - Walkthrough de cada módulo
   - Simular emissão de NF completa
   - Simular geração de duplicata + pagamento
4. Checklist final de produção

**Resultado esperado:** Kaiqu opera o sistema de forma independente.

---

## Cronograma Estimado (em sessões de trabalho)

| Fase | Tarefa | Sessões |
|------|--------|---------|
| 1 | Auth | 2–3 |
| 1 | Customer payment terms | 1 |
| 1 | Remover WorkOrders | 0.5 |
| 2 | NF-e SEFAZ homologação | 3–4 |
| 2 | Cancelamento/Inutilização | 1 |
| 2 | Migração produção | 1 |
| 3 | Receivables | 2 |
| 3 | Payables | 2 |
| 3 | Billing/Duplicata | 3–4 |
| 4 | Dashboard | 2 |
| 4 | Polish Visual | 2–3 |
| 5 | Deploy scripts | 1–2 |
| 5 | Treinamento | 1 |
| **Total** | | **~25–30 sessões** |

---

## Prioridade de Execução

```
1. Auth               ← sistema inseguro sem isso
2. WorkOrders REMOVE  ← limpeza rápida
3. Customer payment   ← pré-requisito para billing
4. NF-e SEFAZ Homol.  ← coração do negócio
5. Receivables        ← automação pós-NF
6. Payables           ← controle de despesas
7. Billing/Duplicata  ← faturamento mensal
8. NF-e Produção      ← go-live fiscal
9. Dashboard          ← visibilidade gerencial
10. Polish Visual     ← acabamento profissional
11. Deploy Scripts    ← instalação facilitada
12. Treinamento       ← handoff final
```

---

## Pendências
```
1. Ajustar metodo de pagamento dos clientes - há clientes que pagam por NF (ex. 7 ou 28 dias após emissão de nf).
2. Inluir envio de email ao realizar a emissão da NF (XML e PDF) para o cliente e para o escritorio.
3. Geração de faturas sem NF.
4. Valor total da NF não é o valor cobrado, necessário fazer essa distinção para o dashboard e também para a gereção da NF (valor de cobrança indicado no pdf e xml).
5. dashboard de fluxo de caixa, saldo conta no banco, contas a pagar/receber. e dash com infos de processo.
6. lista de processos sem o processo
```



*Plano gerado em co-autoria com Claude Code — Março 2026*
