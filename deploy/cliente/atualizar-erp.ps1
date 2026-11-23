<#
=============================================================================
 ATUALIZAR ERP Tapajos  -  roda no PC do cliente, na pasta C:\ERP-Deploy
 (texto sem acentos de proposito: o PowerShell 5.1 le .ps1 sem BOM no
  codigo de pagina antigo do Windows e estragaria os acentos)

 Uso (pelo ATUALIZAR_ERP.bat, que chama este script):
   ATUALIZAR_ERP.bat                         ultima versao publicada no GitHub
   ATUALIZAR_ERP.bat -Versao v1.1.0          versao especifica (tambem serve para VOLTAR de versao)
   ATUALIZAR_ERP.bat -Versao v1.1.0 -Pacote D:\erp-v1.1.0.tar
                                             PLANO B: sem GitHub/internet, usa o .tar
   ATUALIZAR_ERP.bat -PrimeiraInstalacao     instalacao do zero (permite criar banco novo)

 Passos:
   1. confere o Docker e o volume do banco (nunca sobe com banco vazio por engano)
   2. backup do banco em backups\  (gerado DENTRO do container e copiado com
      docker cp: o pipe do PowerShell 5.1 corrompia os acentos dos backups)
   3. baixa as imagens da versao (ou carrega o .tar)
   4. grava a versao em .env e sobe o sistema
   5. espera o /health responder com a versao nova
 Tudo fica registrado em logs\atualizacao-AAAA-MM-DD_HH-mm.log
=============================================================================
#>
param(
  [string]$Versao = '',
  [string]$Pacote = '',
  [switch]$PrimeiraInstalacao,
  [switch]$SemBackup
)

$ErrorActionPreference = 'Stop'
$Pasta = $PSScriptRoot
Set-Location $Pasta

$Compose     = Join-Path $Pasta 'docker-compose.prod.yml'
$Repo        = 'Leitekaique/ERP-Industrial'
$Projeto     = 'erp-deploy'            # igual ao "name:" do docker-compose.prod.yml
$VolumeBanco = "${Projeto}_postgres_data"
$Imagens     = @('ghcr.io/leitekaique/erp-api', 'ghcr.io/leitekaique/erp-web')

New-Item -ItemType Directory -Force -Path (Join-Path $Pasta 'logs'), (Join-Path $Pasta 'backups') | Out-Null
$LogFile = Join-Path $Pasta ('logs\atualizacao-{0}.log' -f (Get-Date -Format 'yyyy-MM-dd_HH-mm'))
Start-Transcript -Path $LogFile | Out-Null

function Etapa([string]$t) { Write-Host ''; Write-Host "==> $t" -ForegroundColor Cyan }
function Ok([string]$t)    { Write-Host "    [OK] $t" -ForegroundColor Green }
function Aviso([string]$t) { Write-Host "    [!] $t" -ForegroundColor Yellow }
function Falha([string]$t) {
  Write-Host ''
  Write-Host "[ERRO] $t" -ForegroundColor Red
  Write-Host "Registro completo: $LogFile" -ForegroundColor Gray
  Stop-Transcript | Out-Null
  exit 1
}
# Roda um comando docker; para o script se ele falhar
function Rodar-Docker {
  & docker.exe @args
  if ($LASTEXITCODE -ne 0) { throw "docker $($args -join ' ') falhou (codigo $LASTEXITCODE)" }
}
# Roda um comando docker e devolve a saida como texto (sem parar em erro)
function DockerTexto {
  $saida = cmd /c "docker $($args -join ' ') 2>&1"
  return @{ Codigo = $LASTEXITCODE; Texto = ($saida -join "`n") }
}
# Le/grava ERP_VERSION no .env sem apagar outras linhas que existam nele
function Ler-VersaoAtual {
  $envFile = Join-Path $Pasta '.env'
  if (Test-Path $envFile) {
    $linha = Get-Content $envFile | Where-Object { $_ -match '^\s*ERP_VERSION\s*=' } | Select-Object -First 1
    if ($linha) { return ($linha -split '=', 2)[1].Trim() }
  }
  return ''
}
function Gravar-Versao([string]$v) {
  $envFile = Join-Path $Pasta '.env'
  $linhas = @()
  if (Test-Path $envFile) { $linhas = @(Get-Content $envFile | Where-Object { $_ -notmatch '^\s*ERP_VERSION\s*=' }) }
  $linhas += "ERP_VERSION=$v"
  [IO.File]::WriteAllLines($envFile, [string[]]$linhas, (New-Object Text.UTF8Encoding $false))
}

try {
  Write-Host '=================================================' -ForegroundColor Cyan
  Write-Host '  Atualizacao do ERP Tapajos' -ForegroundColor Cyan
  Write-Host '=================================================' -ForegroundColor Cyan

  if (-not (Test-Path $Compose)) { Falha "Nao encontrei $Compose. Copie a pasta deploy\cliente do projeto para C:\ERP-Deploy." }
  if (-not (Test-Path (Join-Path $Pasta '.env.prod'))) { Falha 'Nao encontrei o .env.prod (senhas e configuracao). Ele precisa estar em C:\ERP-Deploy.' }

  # -- 1. Docker --------------------------------------------------------------
  Etapa 'Conferindo o Docker'
  $info = DockerTexto info --format '{{.ServerVersion}}'
  if ($info.Codigo -ne 0) {
    Aviso 'Docker nao esta rodando. Abrindo o Docker Desktop...'
    $exe = @("$env:ProgramFiles\Docker\Docker\Docker Desktop.exe", "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($exe) { Start-Process $exe }
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Seconds 3
      if ((DockerTexto info --format '{{.ServerVersion}}').Codigo -eq 0) { break }
    }
    if ((DockerTexto info --format '{{.ServerVersion}}').Codigo -ne 0) { Falha 'O Docker nao ficou pronto em 3 minutos. Abra o Docker Desktop manualmente e rode de novo.' }
  }
  Ok 'Docker pronto'

  # -- 2. Versao --------------------------------------------------------------
  Etapa 'Definindo a versao'
  $versaoAnterior = Ler-VersaoAtual
  if (-not $Versao) {
    if ($Pacote) { Falha 'Com -Pacote informe tambem a versao do pacote, ex.: -Versao v1.1.0' }
    try {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -UseBasicParsing -TimeoutSec 20
      $Versao = $rel.tag_name
    } catch {
      Falha "Nao consegui consultar a ultima versao no GitHub ($($_.Exception.Message)). Informe a versao (-Versao v1.1.0) ou use o pacote .tar (-Pacote)."
    }
  }
  if ($Versao -notmatch '^v\d+\.\d+\.\d+') { Aviso "Versao '$Versao' fora do padrao vX.Y.Z (ok para teste)." }
  $txtAnterior = $versaoAnterior
  if (-not $txtAnterior) { $txtAnterior = 'modelo antigo (.tar / erp-api:prod)' }
  Write-Host "    Versao atual : $txtAnterior"
  Write-Host "    Nova versao  : $Versao"

  # -- 3. Banco: o volume certo existe? ---------------------------------------
  Etapa 'Conferindo o banco de dados'
  $volumes = @((DockerTexto volume ls -q).Texto -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  if ($volumes -contains $VolumeBanco) {
    Ok "Banco encontrado (volume $VolumeBanco)"
  } elseif ($PrimeiraInstalacao) {
    Aviso 'Primeira instalacao: sera criado um banco NOVO.'
  } else {
    $outros = $volumes | Where-Object { $_ -like '*postgres_data*' }
    $msg = "O volume do banco '$VolumeBanco' nao existe. Subir agora criaria um banco VAZIO."
    if ($outros) { $msg += " Volumes de banco encontrados: $($outros -join ', '). Chame o suporte antes de continuar." }
    else { $msg += ' Se for mesmo uma instalacao do zero, rode com -PrimeiraInstalacao.' }
    Falha $msg
  }

  # Containers com os mesmos nomes criados fora deste projeto (ex.: compose antigo)
  # impediriam a subida. Removemos SO o container: os dados ficam no volume.
  # (chamada direta ao docker.exe: passando pelo cmd as aspas do formato se perdiam)
  $script:recriarContainers = $false
  $containers = @(& docker.exe ps -a --format '{{.Names}}|{{.Labels}}')
  foreach ($linha in $containers) {
    $nome, $labels = $linha -split '\|', 2
    if (@('erp_db', 'erp_api', 'erp_web') -notcontains $nome) { continue }
    $proj = ''
    if ($labels -match 'com\.docker\.compose\.project=([^,]+)') { $proj = $Matches[1] }
    if ($proj -ne $Projeto) {
      $txtProj = $proj
      if (-not $txtProj) { $txtProj = 'criado sem docker compose' }
      Aviso "Container $nome pertence a outro projeto ($txtProj); sera recriado (dados preservados no volume)."
      $script:recriarContainers = $true
    }
  }

  # -- 4. Backup --------------------------------------------------------------
  if ($SemBackup -or -not ($volumes -contains $VolumeBanco)) {
    Aviso 'Backup pulado.'
  } else {
    Etapa 'Backup do banco (antes de qualquer mudanca)'
    $estado = DockerTexto inspect -f '{{.State.Running}}' erp_db
    if ($estado.Texto.Trim() -ne 'true') {
      Aviso 'Banco parado; iniciando so o banco para o backup...'
      $env:ERP_VERSION = $Versao
      Rodar-Docker compose -f $Compose up -d db
    }
    for ($i = 0; $i -lt 30; $i++) {
      if ((DockerTexto exec erp_db pg_isready -U postgres).Codigo -eq 0) { break }
      Start-Sleep -Seconds 2
    }
    $arquivo = Join-Path $Pasta ('backups\antes-{0}-{1}.sql' -f $Versao, (Get-Date -Format 'yyyy-MM-dd_HH-mm'))
    Rodar-Docker exec erp_db pg_dump -U postgres -d erp -f /tmp/backup-atualizacao.sql
    Rodar-Docker cp "erp_db:/tmp/backup-atualizacao.sql" $arquivo
    Rodar-Docker exec erp_db rm -f /tmp/backup-atualizacao.sql
    $fim = [IO.File]::ReadAllText($arquivo)
    if ((Get-Item $arquivo).Length -lt 1000 -or $fim -notmatch 'PostgreSQL database dump complete') {
      Falha "Backup incompleto ($arquivo). Atualizacao cancelada; nada foi alterado."
    }
    Ok ("Backup: {0} ({1:N1} MB)" -f $arquivo, ((Get-Item $arquivo).Length / 1MB))
  }

  # -- 5. Imagens -------------------------------------------------------------
  $env:ERP_VERSION = $Versao
  # Versao vX.Y.Z nunca muda depois de publicada: se ja esta neste PC (ex.: voltar
  # para a versao anterior), usa a copia local - funciona ate sem internet
  $jaTem = ($Versao -match '^v\d+\.\d+\.\d+') -and -not ($Imagens | Where-Object { (DockerTexto image inspect "${_}:$Versao").Codigo -ne 0 })
  if ($Pacote) {
    Etapa "Carregando o pacote $Pacote (plano B)"
    if (-not (Test-Path $Pacote)) { Falha "Pacote nao encontrado: $Pacote" }
    Rodar-Docker load -i $Pacote
  } elseif ($jaTem) {
    Etapa 'Imagens desta versao ja estao neste PC (sem download)'
  } else {
    Etapa 'Baixando as imagens do GitHub (so o que mudou)'
    $pull = DockerTexto compose -f "`"$Compose`"" pull api web
    Write-Host $pull.Texto
    if ($pull.Codigo -ne 0) {
      if ($pull.Texto -match 'denied|unauthorized') {
        Falha "Acesso negado as imagens. Se o pacote no GitHub for privado, rode uma vez: docker login ghcr.io -u Leitekaique  (senha = token com permissao read:packages). Ou use o plano B (-Pacote)."
      }
      Falha 'Nao consegui baixar as imagens. Verifique a internet ou use o plano B (-Pacote arquivo.tar).'
    }
  }
  foreach ($img in $Imagens) {
    if ((DockerTexto image inspect "${img}:$Versao").Codigo -ne 0) { Falha "Imagem ${img}:$Versao nao esta disponivel neste PC." }
  }
  Ok 'Imagens prontas'

  # -- 6. Subir ---------------------------------------------------------------
  Etapa "Subindo a versao $Versao"
  if ($versaoAnterior -and $versaoAnterior -ne $Versao) {
    Set-Content -Path (Join-Path $Pasta 'versao-anterior.txt') -Value $versaoAnterior -Encoding ASCII
  }
  if ($script:recriarContainers) {
    foreach ($c in @('erp_web', 'erp_api', 'erp_db')) { cmd /c "docker rm -f $c >nul 2>&1" }
  }
  # $env:ERP_VERSION ja aponta para a nova versao; o .env so e gravado se subir
  Rodar-Docker compose -f $Compose up -d --remove-orphans
  Gravar-Versao $Versao   # persiste para o INICIAR_ERP.bat / reinicios usarem esta versao

  # -- 7. Conferir ------------------------------------------------------------
  Etapa 'Aguardando o sistema responder (migracoes do banco rodam agora)'
  $saude = $null
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 3
    try { $saude = Invoke-RestMethod -Uri 'http://localhost:3000/health' -UseBasicParsing -TimeoutSec 5; if ($saude.ok) { break } } catch { }
  }
  if (-not $saude -or -not $saude.ok) {
    Write-Host ''
    Write-Host '--- ultimas linhas do log da API ---' -ForegroundColor Gray
    cmd /c 'docker logs --tail 40 erp_api 2>&1'
    $volta = Get-Content (Join-Path $Pasta 'versao-anterior.txt') -ErrorAction SilentlyContinue
    $dica = 'Para voltar: ATUALIZAR_ERP.bat -Versao <versao anterior>'
    if ($volta) { $dica = "Para voltar: ATUALIZAR_ERP.bat -Versao $volta" }
    Falha "A API nao respondeu em 3 minutos. $dica  (o backup do banco esta em backups\)"
  }
  if ($saude.version -and $saude.version -ne $Versao) {
    Aviso "A API respondeu, mas com a versao '$($saude.version)' (esperado '$Versao')."
  } else {
    Ok "API no ar - versao $($saude.version)"
  }

  # Limpa so imagens sem nome (as versoes anteriores ficam para poder voltar)
  cmd /c 'docker image prune -f >nul 2>&1'

  Write-Host ''
  Write-Host '=================================================' -ForegroundColor Green
  Write-Host "  ERP Tapajos atualizado para $Versao" -ForegroundColor Green
  Write-Host '=================================================' -ForegroundColor Green
  Stop-Transcript | Out-Null
  exit 0
}
catch {
  Falha $_.Exception.Message
}
