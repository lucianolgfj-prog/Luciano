@echo off
setlocal
cd /d "%~dp0.."
set APP_MODE=demo
set NODE_ENV=development
set LOCAL_DEMO_BYPASS=true
set NEXTAUTH_URL=http://127.0.0.1:3000
call docker compose up -d --wait db
if errorlevel 1 exit /b 1
call npm.cmd run db:generate
if errorlevel 1 exit /b 1
call npm.cmd run db:migrate
if errorlevel 1 exit /b 1
call npm.cmd run db:seed
if errorlevel 1 exit /b 1
echo Abra http://127.0.0.1:3000 - entrada direta como Luciano, somente dados ficticios.
call node_modules\.bin\next.cmd dev --webpack --hostname 127.0.0.1 --port 3000
exit /b %errorlevel%
