@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Oraculo da Alma - Instalacao (Windows)

echo ==============================================
echo    ORACULO DA ALMA - Instalacao Windows
echo ==============================================
echo.
echo  Este projeto NAO precisa de Visual Studio,
echo  Python ou compilador C++. Apenas Node.js.
echo.

REM ---- 1. Verifica Node.js ----
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js nao encontrado no PATH. Procurando instalacao padrao...
  if exist "C:\Program Files\nodejs\node.exe" (
    set "PATH=C:\Program Files\nodejs;!PATH!"
    echo [OK] Node encontrado em C:\Program Files\nodejs e adicionado ao PATH desta sessao.
  ) else if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;!PATH!"
    echo [OK] Node encontrado em %LOCALAPPDATA%\Programs\nodejs.
  ) else (
    echo [ERRO] Node.js nao esta instalado. Baixe a versao LTS em https://nodejs.org
    pause
    exit /b 1
  )
)

for /f "delims=" %%v in ('node -v') do set NODEVER=%%v
echo [OK] Node.js !NODEVER!
for /f "delims=" %%v in ('npm -v') do set NPMVER=%%v
echo [OK] npm !NPMVER!
echo.

REM ---- 2. Prepara o .env ----
if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo [OK] Arquivo .env criado a partir de .env.example.
    echo     Abra o .env e defina JWT_SECRET e OPENAI_API_KEY.
  )
) else (
  echo [OK] .env ja existe.
)
echo.

REM ---- 3. Instala dependencias (tudo JavaScript/WASM, sem compilar nada) ----
echo Instalando dependencias ^(npm install^)...
call npm install
if errorlevel 1 (
  echo.
  echo [ERRO] npm install falhou. Leia a mensagem acima.
  pause
  exit /b 1
)
echo [OK] Dependencias instaladas sem compilacao nativa.
echo.

REM ---- 4. Inicia o projeto ----
echo ==============================================
echo    Iniciando o servidor...
echo    Abra no navegador: http://localhost:3000
echo    ^(Para parar: Ctrl + C^)
echo ==============================================
echo.
call npm start

pause
