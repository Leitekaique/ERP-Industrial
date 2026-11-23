<#
=============================================================================
 Corrige os acentos de um backup ANTIGO (gerado antes de nov/2026 com
 "docker exec ... pg_dump | Out-File"). Nao altera o arquivo original.

   powershell.exe -ExecutionPolicy Bypass -File corrigir-backup-antigo.ps1 -Arquivo backups\erp-backup-2026-11-20_12-00.sql

 O que aconteceu com esses backups: o PowerShell 5.1 leu os bytes UTF-8 do
 pg_dump como se fossem do codigo de pagina 850 ("c-cedilha" virou "├º") e
 gravou esse texto ja trocado. Como o 850 tem um caractere para cada byte,
 da para desfazer sem perda: converter o texto de volta para bytes 850
 devolve exatamente os bytes UTF-8 originais. Se algum caractere nao couber
 no 850, o script para e avisa (nao gera arquivo meio corrigido).

 Gera: <arquivo>.corrigido.sql  (UTF-8, quebras de linha LF como o pg_dump gera)
=============================================================================
#>
param([Parameter(Mandatory = $true)][string]$Arquivo)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Arquivo)) { Write-Host "Arquivo nao encontrado: $Arquivo" -ForegroundColor Red; exit 1 }
$origem  = (Resolve-Path $Arquivo).Path
$destino = [IO.Path]::ChangeExtension($origem, '.corrigido.sql')

# Detecta a codificacao do arquivo pelo BOM (Out-File UTF8 grava EF BB BF; o padrao grava FF FE)
$bytes = [IO.File]::ReadAllBytes($origem)
if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) { $texto = [Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length - 2) }
elseif ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { $texto = [Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3) }
else { $texto = [Text.Encoding]::UTF8.GetString($bytes) }

if ($texto -notmatch '├') {
  Write-Host 'Este arquivo nao parece ter os acentos corrompidos (nenhum "├" encontrado). Nada a fazer.' -ForegroundColor Yellow
  exit 0
}

$cp850  = [Text.Encoding]::GetEncoding(850, [Text.EncoderFallback]::ExceptionFallback, [Text.DecoderFallback]::ExceptionFallback)
$utf8Estrito = New-Object Text.UTF8Encoding($false, $true)
try {
  $original = $cp850.GetBytes($texto)
  $null = $utf8Estrito.GetString($original)   # confere que o resultado e UTF-8 valido
} catch {
  Write-Host "Nao foi possivel reverter sem perda: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

# Out-File trocou LF por CRLF; volta para LF
$saida = $utf8Estrito.GetString($original).Replace("`r`n", "`n")
[IO.File]::WriteAllText($destino, $saida, (New-Object Text.UTF8Encoding $false))
Write-Host "[OK] Backup corrigido: $destino" -ForegroundColor Green
