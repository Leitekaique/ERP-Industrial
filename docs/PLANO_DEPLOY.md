# Plano de Deploy — ERP Tapajós
> Versão 1.0 — 2026-03-26
> Deploy previsto: segunda-feira, 30/03/2026

---

## Visão geral da arquitetura

```
PC do usuário (Windows)
│
├── Docker Desktop
│   ├── erp_db  (PostgreSQL 15) ←── volume: postgres_data
│   └── erp_api (NestJS 10)    ←── volume: uploads/, logs/
│
└── Frontend (React)
    └── Servido pelo erp_api em /public  ← build estático
        (ou via http-server local)
```

**Dados persistentes ficam em:**
- Banco de dados: volume Docker `postgres_data` (gerenciado pelo Docker)
- XMLs/PDFs/uploads: pasta `ERP/uploads/`
- Logs: pasta `ERP/logs/`

---

## FASE 1 — Preparação (hoje / até domingo 29/03)

### 1.1 Confirmar numeração de NF-e e Fatura

> **Ação necessária antes do deploy:**

Verificar qual foi a última NF-e emitida em produção (olhar nos livros fiscais ou no sistema anterior). Pelos XMLs em `/docs`, a última foi ~6198. O usuário mencionou ~6600 — confirmar.

Verificar última duplicata/fatura emitida. PDFs em `/docs` mostram 3239/3240. Confirmar número correto.

Esses valores serão usados na **Fase 3, passo 3.4**.

### 1.2 Obter o certificado digital A1

O certificado digital é obrigatório para emitir NF-e em produção.

- **Formato:** arquivo `.pfx` (PKCS#12) — certificado A1 da empresa (Tapajós)
- **Onde obter:** com a contabilidade ou com a entidade certificadora (Certisign, Serasa, etc.)
- **O que precisa:** o arquivo `.pfx` + a senha do certificado
- **Onde colocar no deploy:** pasta `ERP/certs/tapajos-cert.pfx`

> Se o certificado já expirou, é necessário renová-lo antes do deploy em produção.

### 1.3 Configurar o e-mail (SMTP)

Para envio de NFs, faturas e alertas, configurar uma conta de e-mail:

**Opção recomendada:** Gmail com App Password
1. Criar ou usar uma conta Gmail da empresa (ex: `erp@tapajos.com.br` ou usar `kaique_310@hotmail.com` provisoriamente)
2. Ativar verificação em duas etapas na conta
3. Gerar uma "App Password" em: Conta Google → Segurança → Senhas de app
4. Usar essa senha no `.env.prod`

**Configuração no `.env.prod`:**
```env
MAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seuemail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx   ← App Password (16 chars)
SMTP_FROM=ERP Tapajós <seuemail@gmail.com>
```

### 1.4 Build do frontend

```bash
# Na máquina de dev (este computador)
cd e:/ERP/web
npm run build
# Gera: e:/ERP/web/dist/
```

O `dist/` será copiado para a máquina de destino junto com tudo.

### 1.5 Exportar o banco de dados (se quiser migrar dados de teste)

Se quiser levar os dados cadastrados durante o desenvolvimento (clientes, fornecedores, produtos, processos):

```bash
docker exec erp_db pg_dump -U postgres erp > e:/ERP/backup-pre-deploy.sql
```

> **Decisão importante:** levar dados de teste ou começar do zero?
> - Recomendo **começar do zero** para o banco, mas manter o backup como referência.
> - Importar apenas dados mestres essenciais (clientes, fornecedores, produtos) via planilha (a16).

---

## FASE 2 — Configuração da máquina destino

### 2.1 Pré-requisitos (instalar no PC do usuário)

| Software | Link | Notas |
|----------|------|-------|
| Docker Desktop | docker.com/products/docker-desktop | Versão para Windows; requer WSL2 |
| WSL2 (Windows Subsystem for Linux) | Ativado pelo Docker Desktop automaticamente | Pode precisar de reinicialização |
| Git (opcional) | git-scm.com | Útil para atualizações futuras |

**Requisitos mínimos do PC:**
- Windows 10/11 (64-bit)
- 8 GB RAM (recomendado 16 GB)
- 20 GB espaço em disco livre
- Processador com virtualização habilitada (checar BIOS se necessário)

### 2.2 Transferir os arquivos do ERP

**Opção A — Pen drive / HD externo (mais simples):**
```
Copiar a pasta E:\ERP inteira para o PC de destino
(excluir: node_modules/, web/node_modules/, .git/)
```

**Opção B — Rede local:**
```bash
# Compartilhar pasta ou usar robocopy
robocopy E:\ERP \\destino\ERP /E /XD node_modules .git dist
```

**O que DEVE estar na pasta transferida:**
```
ERP/
├── docker-compose.yml      ✅
├── Dockerfile              ✅
├── .env.prod               ✅ (criar — ver passo 2.3)
├── entrypoint.sh           ✅
├── prisma/                 ✅
├── src/                    ✅
├── dist/                   ✅ (build do backend)
├── web/dist/               ✅ (build do frontend — passo 1.4)
├── uploads/                ✅ (vazio ou com dados de dev)
├── certs/
│   └── tapajos-cert.pfx    ✅ (certificado digital)
└── scripts/
    └── backup.ps1          ✅ (criar — passo 2.5)
```

### 2.3 Criar o arquivo `.env.prod`

Criar o arquivo `ERP/.env.prod` (NÃO commitar no git):

```env
# ================================
# 🌍 Ambiente
# ================================
NODE_ENV=production
PORT=3000

# ================================
# 🗃️ Banco de Dados
# ================================
DATABASE_URL=postgresql://postgres:SENHA_FORTE_AQUI@db:5432/erp?schema=public

# ================================
# 🔐 Autenticação
# ================================
JWT_SECRET=TROQUE_POR_UMA_CHAVE_LONGA_E_ALEATORIA_AQUI_32chars+
JWT_EXPIRES_IN=12h

# ================================
# 📡 SEFAZ / NF-e
# ================================
SEFAZ_ENV=producao        # ← MUDA DE simulator PARA producao
SEFAZ_UF=35               # 35 = São Paulo

CERT_PASSWORD=SENHA_DO_CERTIFICADO_PFX

# ================================
# 📧 E-mail / SMTP
# ================================
MAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@dominio.com.br
SMTP_PASS=app_password_aqui
SMTP_FROM=ERP Tapajós <email@dominio.com.br>

# E-mail destino para cópia dos documentos fiscais
OVERRIDE_EMAIL=           # Deixar vazio em produção (usa e-mail do cliente/contador)

# ================================
# 🗃️ Prisma
# ================================
PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x,linux-musl
PRISMA_GENERATE_SKIP_DOWNLOAD=true
PRISMA_CLI_QUERY_ENGINE_TYPE=library
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
PRISMA_LOG_LEVEL=warn
PRISMA_HIDE_UPDATE_MESSAGE=true
```

### 2.4 Ajustar o `docker-compose.yml` para produção

Alterar a linha do `env_file` para apontar para `.env.prod`:

```yaml
# Trocar:
env_file:
  - .env.dev

# Por:
env_file:
  - .env.prod
```

Também remover os volumes de desenvolvimento (src e prisma mapeados):
```yaml
volumes:
  - ./uploads:/usr/src/app/uploads
  - ./logs:/usr/src/app/logs
  # REMOVER as linhas abaixo em produção:
  # - ./src:/usr/src/app/src:cached
  # - ./prisma:/usr/src/app/prisma:cached
```

### 2.5 Configurar backup automático diário

Criar o arquivo `ERP/scripts/backup.ps1`:

```powershell
# backup.ps1 — Backup diário do banco de dados ERP Tapajós
$date = Get-Date -Format "yyyy-MM-dd"
$backupDir = "C:\ERP\backups"
$backupFile = "$backupDir\erp-backup-$date.sql"

# Garante que a pasta existe
New-Item -ItemType Directory -Force -Path $backupDir

# Dump do banco
docker exec erp_db pg_dump -U postgres erp | Out-File -FilePath $backupFile -Encoding UTF8

# Mantém apenas os últimos 30 backups locais
Get-ChildItem "$backupDir\erp-backup-*.sql" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 30 |
  Remove-Item -Force

Write-Host "✅ Backup concluído: $backupFile"
```

**Agendar no Windows Task Scheduler:**
1. Abrir "Agendador de Tarefas" (Task Scheduler)
2. Criar Tarefa Básica → Nome: "ERP Backup Diário"
3. Gatilho: Diário, às 12:00
4. Ação: Iniciar programa → `powershell.exe`
5. Argumentos: `-ExecutionPolicy Bypass -File "C:\ERP\scripts\backup.ps1"`

**Opcional — Backup na nuvem (Google Drive com rclone):**
```powershell
# Adicionar ao final do backup.ps1:
# rclone copy $backupFile gdrive:ERP-Backups/
# (requer rclone configurado com conta Google)
```

---

## FASE 3 — Inicialização no PC de destino

### 3.1 Subir os containers

```bash
# Na pasta ERP/
docker compose up -d
```

Aguardar ~30 segundos. Verificar:
```bash
docker logs erp_api --tail 20
# Deve aparecer: "🚀 Application is running on port 3000"
```

### 3.2 Verificar que as migrações rodaram

```bash
docker logs erp_api | grep "migra"
# Deve aparecer: "🗃️ Executando migrações Prisma..."
# E: "✅ Migrações aplicadas com sucesso"
```

### 3.3 Acessar o sistema pela primeira vez

Abrir o browser: `http://localhost:3000`

Fazer login com as credenciais de admin.

> **Atenção:** Se o banco estava vazio, o seed cria o usuário admin padrão. Checar as credenciais no código (`scripts/seed.ts` ou similar).

### 3.4 Configurar numeração inicial de NF-e e Fatura

**Esta etapa é crítica — executar ANTES de emitir qualquer NF em produção.**

Conectar ao banco:
```bash
docker exec -it erp_db psql -U postgres -d erp
```

Executar os comandos:
```sql
-- Define o número inicial da NF-e
-- Substitua 6599 pelo (último número real emitido - 1)
-- Ex: se a última NF foi a 6198, coloque 6197
INSERT INTO "Nfe" (
  id, "tenantId", "companyId", number, series, status,
  "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), 'T-001', 'C-001',
  6599,   -- ← AJUSTAR: último nº real emitido
  1, 'authorized',
  NOW(), NOW()
);

-- Define o número inicial da Fatura/Duplicata
-- Substitua 3300 pelo número correto
ALTER SEQUENCE "Billing_billingNumber_seq" RESTART WITH 3301;
-- ← AJUSTAR: próximo número de duplicata

-- Confirmar
SELECT MAX(number) FROM "Nfe";
SELECT last_value FROM "Billing_billingNumber_seq";

\q
```

> ⚠️ **Confirmar os valores corretos com o escritório contábil antes de executar.**

### 3.5 Configurar o certificado digital

Colocar o arquivo `.pfx` na pasta:
```
ERP/certs/tapajos-cert.pfx
```

Reiniciar o container para recarregar:
```bash
docker restart erp_api
```

Testar emissão em **homologação** primeiro:
1. Mudar `.env.prod`: `SEFAZ_ENV=homologacao`
2. Restart: `docker restart erp_api`
3. Emitir uma NF de teste
4. Se autorizada com cStat=100: certificado OK
5. Mudar de volta: `SEFAZ_ENV=producao` + restart

### 3.6 Testar o fluxo completo (checklist)

```
[ ] Login funciona
[ ] Cadastrar cliente de teste
[ ] Cadastrar produto de teste
[ ] Criar processo de teste
[ ] Movimentar estoque (entrada)
[ ] Emitir NF-e (rascunho → finalizar → autorizar)
[ ] Verificar NF-e autorizada na lista
[ ] Baixar XML e PDF (DANFE)
[ ] Verificar recebível gerado automaticamente
[ ] Gerar fatura (billing)
[ ] Enviar fatura por e-mail
[ ] Marcar fatura como paga
[ ] Verificar dashboard (faturamento, gráficos)
[ ] Importar NF-e de entrada (XML de fornecedor)
[ ] Verificar conta a pagar gerada
[ ] Testar backup (rodar script manualmente)
```

---

## FASE 4 — Configuração de rede (acesso pela LAN/celular)

Para o gerente acessar pelo celular na mesma rede:

```bash
# Descobrir o IP do PC na rede local
ipconfig
# Exemplo: 192.168.1.100
```

Acessar do celular: `http://192.168.1.100:3000`

**Para acesso externo (fora da empresa) — futuro:**
- Opção simples: usar Tailscale (VPN P2P, gratuito para uso pessoal)
- Opção avançada: configurar port forwarding no roteador + DDNS

---

## FASE 5 — Pós-deploy e monitoramento

### 5.1 Monitorar os primeiros dias

```bash
# Ver logs em tempo real
docker logs -f erp_api

# Ver uso de recursos
docker stats
```

### 5.2 Verificar backups

Após 24h do deploy, confirmar que o backup automático rodou:
```
C:\ERP\backups\erp-backup-2026-03-31.sql   ← deve existir
```

### 5.3 Procedimento de atualização futura

Para aplicar melhorias futuras no sistema:

```bash
# 1. Copiar novos arquivos src/ e web/dist/
# 2. Reconstruir
docker exec erp_api sh -c "cd /usr/src/app && npm run build"
docker restart erp_api
```

---

## RESUMO — Checklist do dia do deploy

```
PRÉ-DEPLOY (hoje/domingo):
[ ] Confirmar último número de NF-e emitida
[ ] Confirmar último número de fatura/duplicata
[ ] Obter arquivo .pfx do certificado digital A1 + senha
[ ] Build do frontend: cd web && npm run build
[ ] Criar .env.prod com todas as configs preenchidas
[ ] Exportar backup do banco atual (opcional)

NO PC DE DESTINO:
[ ] Instalar Docker Desktop + WSL2
[ ] Copiar pasta ERP completa (sem node_modules)
[ ] Ajustar docker-compose.yml (env_file → .env.prod, remover volumes dev)
[ ] docker compose up -d
[ ] Verificar logs (aplicação iniciou)
[ ] Configurar numeração NF-e e Fatura (SQL)
[ ] Copiar certificado .pfx para ERP/certs/
[ ] Testar em homologação com certificado
[ ] Mudar para produção (SEFAZ_ENV=producao)
[ ] Executar checklist de testes (seção 3.6)
[ ] Configurar backup automático (Task Scheduler)

PÓS-DEPLOY (dia seguinte):
[ ] Confirmar que backup rodou às 12h
[ ] Verificar logs sem erros
[ ] Treinar usuário (ver doc de treinamento)
```

---

## Dúvidas respondidas

| # | Dúvida | Resposta |
|---|--------|----------|
| 1 | Onde ficam os dados? | Banco: volume Docker `postgres_data`. Uploads: pasta `ERP/uploads/`. |
| 2 | Como consultar o banco? | `docker exec -it erp_db psql -U postgres -d erp` ou DBeaver em localhost:5432 |
| 3 | Dados fiscais suficientes? | XMLs estão salvos em uploads/ (documento legal). Registros estruturados no banco. A26 pendente para auditoria detalhada. |
| 4 | Importar dados aqui ou no PC do usuário? | **Aqui**, antes do deploy. O banco vai junto com tudo no deploy. |
| 5 | Backup duplo (local + nuvem)? | Sim — script `backup.ps1` + rclone opcional para Google Drive. |
| 7 | Numeração inicial NF (~6600) e duplicata (~3300)? | Configurado via SQL antes da primeira emissão (seção 3.4). **Confirmar o número exato.** |
| 8 | Certificado digital? | Arquivo `.pfx` em `ERP/certs/` + `CERT_PASSWORD` no `.env.prod` (seção 1.2 e 3.5). |
| 9 | Treinamento? | Elaborar após deploy — baseado nos fluxos reais testados. |
| 11 | Acesso gerente pelo celular? | IP local da máquina + porta 3000. VPN para acesso externo. Pendência a20. |

---

## Sobre a planilha (a16 — Tabela de Preços.xlsx)

A importação da planilha deve ser feita **antes do deploy**, aqui nesta máquina, para que os dados migrem junto com o banco.

**Próximos passos para alinhar:**
1. Abrir a planilha e identificar as colunas (cliente, processo, valor, período...)
2. Mapear para os modelos do ERP (Process, Receivable, Billing, ou somente referência)
3. Criar script de importação ou fazer via interface
4. Os dados importados ficarão no banco e irão junto no deploy

---

_Criado em: 2026-03-26_
