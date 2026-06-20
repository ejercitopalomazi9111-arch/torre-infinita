@echo off
title Torre Infinita - Servidor (no cierres esta ventana mientras juegas)
cd /d "%~dp0"

echo ============================================
echo            TORRE INFINITA
echo ============================================
echo.

REM Instala dependencias la primera vez si faltan
if not exist "node_modules\vite" (
  echo Primera vez: instalando dependencias, espera un momento...
  call npm install
)

REM Abre el navegador en cuanto el servidor este listo (espera 4s, sin pantalla de error)
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 4; Start-Process 'http://localhost:5173/'"

echo Abriendo el juego en tu navegador...
echo Para CERRAR el juego: cierra esta ventana negra.
echo.
call npm run dev
