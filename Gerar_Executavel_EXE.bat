@echo off
title TechCell - Gerador de Executavel Windows (.exe)
color 0a
echo ================================================================
echo           TECHCELL PDV & ASSISTENCIA TECNICA PRO
echo             Compilador de Executavel Windows (.exe)
echo ================================================================
echo.
echo Este script vai gerar os seguintes instaladores na pasta \dist-electron:
echo  1. TechCell PDV & Assistencia Setup.exe (Instalador com atalho na Area de Trabalho)
echo  2. TechCell PDV & Assistencia Portable.exe (Versao portatil sem instalacao)
echo.
echo [1/3] Compilando interface React e servidor SQLite...
call npm run build
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao compilar o sistema.
    pause
    exit /b
)

echo.
echo [2/3] Empacotando executaveis para Windows x64...
call npm run dist:win
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao gerar o executavel com electron-builder.
    pause
    exit /b
)

echo.
echo ================================================================
echo       [SUCESSO] EXECUTAVEL GERADO COM SUCESSO!
echo ================================================================
echo.
echo Seus arquivos .exe estao prontos na pasta:
echo   - dist-electron\TechCell PDV ^& Assistencia Setup.exe
echo   - dist-electron\TechCell PDV ^& Assistencia Portable.exe
echo.
echo Abrindo a pasta dos executaveis...
if exist "dist-electron" (
    explorer dist-electron
)
pause
