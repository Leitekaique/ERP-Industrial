@echo off
echo Iniciando ERP Tapajos...

:: Sobe os containers (ignora se ja estiver rodando)
cd /d C:\ERP-Deploy
docker compose -f docker-compose.prod.yml up -d

:: Aguarda a API estar pronta
echo Aguardando API...
:wait
curl -s http://localhost:3000/health >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto wait
)

:: Abre o navegador
echo Abrindo ERP...
start http://localhost