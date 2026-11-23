<#
=============================================================================
 Backup do banco - ERP Tapajos  (PC do cliente, C:\ERP-Deploy)
 Roda pelo Agendador de Tarefas (ex.: todo dia 12h) ou manualmente:
   powershell.exe -ExecutionPolicy Bypass -File "C:\ERP-Deploy\backup-banco.ps1"

 Por que o arquivo e gerado DENTRO do container e copiado com docker cp:
 o pipe do PowerShell 5.1 ("docker exec ... pg_dump | Out-File") le a saida
 no codigo de pagina antigo do console (850) e estraga os acentos
 ("IMPORTACAO" com C-cedilha vira "IMPORTA├ç├âO"). Copiando o arquivo, os
 bytes UTF-8 chegam intactos.

 Restaurar um backup (CUIDADO: substitui o banco):
   docker cp backups\arquivo.sql erp_db:/tmp/restore.sql
   docker exec erp_db psql -U postgres -d erp -f /tmp/restore.sql
=============================================================================
#>
param([int]$Manter = 90)

$Pasta     = $PSScriptRoot
$BackupDir = Join-Path $Pasta 'backups'
$Arquivo   = Join-Path $BackupDir ('erp-backup-{0}.sql' -f (Get-Date -Format 'yyyy-MM-dd_HH-mm'))
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

Write-Host "$(Get-Date -Format 'dd/MM/yyyy HH:mm') - Iniciando backup..." -ForegroundColor Cyan

$rodando = cmd /c 'docker inspect -f "{{.State.Running}}" erp_db 2>&1'
if ($rodando -ne 'true') {
  Write-Host '[ERRO] Container erp_db nao esta rodando. Backup cancelado.' -ForegroundColor Red
  exit 1
}

& docker exec erp_db pg_dump -U postgres -d erp -f /tmp/backup-diario.sql
if ($LASTEXITCODE -ne 0) { Write-Host '[ERRO] pg_dump falhou.' -ForegroundColor Red; exit 1 }
& docker cp 'erp_db:/tmp/backup-diario.sql' $Arquivo
$copiou = $LASTEXITCODE
& docker exec erp_db rm -f /tmp/backup-diario.sql | Out-Null
if ($copiou -ne 0 -or -not (Test-Path $Arquivo)) { Write-Host '[ERRO] Falha ao copiar o backup.' -ForegroundColor Red; exit 1 }

# Confere se o dump chegou completo (o pg_dump escreve esta linha no final)
if ([IO.File]::ReadAllText($Arquivo) -notmatch 'PostgreSQL database dump complete') {
  Write-Host "[ERRO] Backup incompleto: $Arquivo" -ForegroundColor Red
  exit 1
}
Write-Host ('[OK] Backup salvo: {0} ({1:N2} MB)' -f $Arquivo, ((Get-Item $Arquivo).Length / 1MB)) -ForegroundColor Green

# Mantem apenas os ultimos $Manter backups diarios (os "antes-vX.Y.Z" da atualizacao nao sao apagados)
$todos = Get-ChildItem (Join-Path $BackupDir 'erp-backup-*.sql') | Sort-Object LastWriteTime -Descending
if ($todos.Count -gt $Manter) {
  $apagar = $todos | Select-Object -Skip $Manter
  $apagar | Remove-Item -Force
  Write-Host "[LIMPEZA] $($apagar.Count) backup(s) antigo(s) removido(s)" -ForegroundColor Gray
}

Write-Host "$(Get-Date -Format 'dd/MM/yyyy HH:mm') - Backup concluido." -ForegroundColor Cyan
