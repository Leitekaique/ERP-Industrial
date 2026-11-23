@echo off
REM Atualiza o ERP Tapajos. Parametros opcionais: -Versao v1.1.0  -Pacote arquivo.tar  -PrimeiraInstalacao
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0atualizar-erp.ps1" %*
pause
