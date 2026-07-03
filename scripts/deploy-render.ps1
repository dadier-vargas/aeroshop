# AeroShop — checklist previo al deploy en Render
# Ejecutar: powershell -ExecutionPolicy Bypass -File scripts/deploy-render.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "`n=== AeroShop — Pre-deploy Render ===`n" -ForegroundColor Cyan

# 1. Tests
Write-Host "[1/4] Ejecutando tests..." -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) { throw "Los tests fallaron. Corrige antes de desplegar." }
Write-Host "  OK tests`n" -ForegroundColor Green

# 2. Git
Write-Host "[2/4] Verificando Git..." -ForegroundColor Yellow
if (-not (Test-Path ".git")) {
    git init
    Write-Host "  Repositorio Git inicializado." -ForegroundColor Green
}

$status = git status --porcelain
if ($status) {
    Write-Host "  Hay cambios sin commitear:" -ForegroundColor Yellow
    git status --short
    Write-Host "  Ejecuta: git add . && git commit -m 'tu mensaje'" -ForegroundColor Yellow
} else {
    Write-Host "  OK working tree limpio" -ForegroundColor Green
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
    Write-Host "`n  [!] Sin remote 'origin'. Crea un repo en GitHub y ejecuta:" -ForegroundColor Magenta
    Write-Host "      git remote add origin https://github.com/TU_USUARIO/aeroshop.git"
    Write-Host "      git branch -M main"
    Write-Host "      git push -u origin main"
} else {
    Write-Host "  Remote: $remote" -ForegroundColor Green
}

# 3. Variables Render
Write-Host "`n[3/4] Variables obligatorias en Render Dashboard:" -ForegroundColor Yellow
@(
    "STRIPE_SECRET_KEY=sk_test_...",
    "STRIPE_PUBLISHABLE_KEY=pk_test_...",
    "PUBLIC_URL=https://TU-APP.onrender.com",
    "CORS_ORIGINS=https://TU-APP.onrender.com"
) | ForEach-Object { Write-Host "  $_" }

Write-Host "`n[4/4] En Render: New -> Blueprint -> conecta el repo (lee render.yaml)" -ForegroundColor Yellow
Write-Host "Guia completa: RENDER_DEPLOY.md`n" -ForegroundColor Cyan