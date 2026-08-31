@echo off
title TechCell - PDV & Assistencia Tecnica (Windows Desktop)
color 0b
echo ================================================================
echo           TECHCELL PDV & ASSISTENCIA TECNICA PRO
echo                Iniciando em Janela Windows Desktop
echo ================================================================
echo.
echo 1. Verificando ambiente Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao foi encontrado no seu computador!
    echo Por favor, instale o Node.js v18+ em: https://nodejs.org
    pause
    exit /b
)

echo 2. Iniciando Servidor SQLite e Janela do Aplicativo...
echo.
npm run electron

if %errorlevel% neq 0 (
    echo.
    echo Ocorreu um erro ao abrir a janela desktop.
    echo Tentando abrir no navegador padrao...
    start http://localhost:3000
    npm run dev
)
pause
