# AeroShop — Asistente configuración Google OAuth
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $projectRoot ".env"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " AeroShop — Configurar Google OAuth" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "URLs que DEBES registrar en Google Cloud:" -ForegroundColor Yellow
Write-Host "  Origen JavaScript:  http://localhost:5000"
Write-Host "  Redirect URI:       http://localhost:5000/auth/google/callback"
Write-Host ""

$steps = @(
  @{ Name = "1. Consent screen"; Url = "https://console.cloud.google.com/apis/credentials/consent" },
  @{ Name = "2. Credentials"; Url = "https://console.cloud.google.com/apis/credentials" }
)

foreach ($step in $steps) {
  Write-Host "Abriendo: $($step.Name)..." -ForegroundColor Green
  Start-Process $step.Url
  Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "En Credentials -> Create Credentials -> OAuth client ID" -ForegroundColor White
Write-Host "  Application type: Web application" -ForegroundColor White
Write-Host "  Name: AeroShop Local" -ForegroundColor White
Write-Host ""
Write-Host "Authorized JavaScript origins:" -ForegroundColor White
Write-Host "  http://localhost:5000" -ForegroundColor Gray
Write-Host ""
Write-Host "Authorized redirect URIs:" -ForegroundColor White
Write-Host "  http://localhost:5000/auth/google/callback" -ForegroundColor Gray
Write-Host ""

$clientId = Read-Host "Pega tu GOOGLE_CLIENT_ID (termina en .apps.googleusercontent.com)"
$clientSecret = Read-Host "Pega tu GOOGLE_CLIENT_SECRET"

if (-not $clientId -or -not $clientSecret) {
  Write-Host "Cancelado: faltan credenciales." -ForegroundColor Red
  exit 1
}

$content = Get-Content $envFile -Raw

if ($content -match "GOOGLE_CLIENT_ID=") {
  $content = $content -replace "GOOGLE_CLIENT_ID=.*", "GOOGLE_CLIENT_ID=$clientId"
} else {
  $content += "`nGOOGLE_CLIENT_ID=$clientId"
}

if ($content -match "GOOGLE_CLIENT_SECRET=") {
  $content = $content -replace "GOOGLE_CLIENT_SECRET=.*", "GOOGLE_CLIENT_SECRET=$clientSecret"
} else {
  $content += "`nGOOGLE_CLIENT_SECRET=$clientSecret"
}

Set-Content -Path $envFile -Value $content.TrimEnd() -NoNewline
Add-Content -Path $envFile -Value ""

Write-Host ""
Write-Host "Credenciales guardadas en .env" -ForegroundColor Green
Write-Host "Reinicia el servidor: npm start" -ForegroundColor Yellow
Write-Host "Prueba: http://localhost:5000/#login -> Continuar con Google" -ForegroundColor Yellow
Write-Host ""