# install-nullprime.ps1  —  Step 1: install Ollama, verify the local API, pull the base.
$ErrorActionPreference = "Stop"

Write-Host "[1/3] Checking for Ollama..." -ForegroundColor Cyan
if (Get-Command ollama -ErrorAction SilentlyContinue) {
    Write-Host "  Already installed: $(ollama --version)" -ForegroundColor Green
} else {
    Write-Host "  Installing via winget..." -ForegroundColor Yellow
    winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
    # Refresh PATH so 'ollama' is callable in THIS session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
    if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
        Write-Host "  'ollama' not on PATH yet. Reopen PowerShell and re-run." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "[2/3] Checking local API (localhost:11434)..." -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 5 | Out-Null
    Write-Host "  API is up." -ForegroundColor Green
} catch {
    Write-Host "  Starting the service..." -ForegroundColor Yellow
    Start-Process ollama -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    try {
        Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 5 | Out-Null
        Write-Host "  API is up." -ForegroundColor Green
    } catch {
        Write-Host "  Can't reach API. Open the Ollama app once, then re-run." -ForegroundColor Red
        exit 1
    }
}

Write-Host "[3/3] Pulling base model (llama3.2, ~2GB)..." -ForegroundColor Cyan
ollama pull llama3.2
Write-Host "Done. Next: .\create-nullprime.ps1" -ForegroundColor Green
