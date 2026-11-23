<#
=============================================================================
 PLANO B - gera o pacote .tar de uma versao (notebook de desenvolvimento)

 Use quando o PC do cliente nao consegue baixar do GitHub (sem internet,
 GitHub fora do ar, problema de acesso as imagens).

   powershell.exe -ExecutionPolicy Bypass -File deploy\gerar-pacote.ps1 -Versao v1.1.0
       baixa as imagens ja publicadas pelo GitHub Actions e salva o .tar

   powershell.exe -ExecutionPolicy Bypass -File deploy\gerar-pacote.ps1 -Versao v1.1.0 -ConstruirLocal
       constroi as imagens aqui (GitHub fora do ar) - leva ~10 min

 Resultado: deploy\pacotes\erp-v1.1.0.tar
 No cliente: copie o .tar para C:\ERP-Deploy e rode
   ATUALIZAR_ERP.bat -Versao v1.1.0 -Pacote C:\ERP-Deploy\erp-v1.1.0.tar
=============================================================================
#>
param(
  [Parameter(Mandatory = $true)][string]$Versao,
  [switch]$ConstruirLocal
)
$ErrorActionPreference = 'Stop'
$Raiz = Split-Path $PSScriptRoot -Parent
$api = "ghcr.io/leitekaique/erp-api:$Versao"
$web = "ghcr.io/leitekaique/erp-web:$Versao"
function Rodar-Docker { & docker.exe @args; if ($LASTEXITCODE -ne 0) { throw "docker $($args -join ' ') falhou" } }

if ($ConstruirLocal) {
  Write-Host "Construindo $api ..." -ForegroundColor Cyan
  Rodar-Docker build --build-arg "APP_VERSION=$Versao" -t $api $Raiz
  Write-Host "Construindo $web ..." -ForegroundColor Cyan
  Rodar-Docker build --build-arg "VITE_APP_VERSION=$Versao" --build-arg 'VITE_API_URL=http://localhost:3000' `
    --build-arg 'VITE_TENANT_ID=T-001' --build-arg 'VITE_COMPANY_ID=C-001' -t $web (Join-Path $Raiz 'web')
} else {
  Write-Host "Baixando $api e $web do GitHub ..." -ForegroundColor Cyan
  Rodar-Docker pull $api
  Rodar-Docker pull $web
}

$saida = Join-Path $PSScriptRoot 'pacotes'
New-Item -ItemType Directory -Force -Path $saida | Out-Null
$tar = Join-Path $saida "erp-$Versao.tar"
Write-Host "Salvando $tar ..." -ForegroundColor Cyan
Rodar-Docker save $api $web -o $tar
Write-Host ("[OK] {0} ({1:N0} MB)" -f $tar, ((Get-Item $tar).Length / 1MB)) -ForegroundColor Green
