# LLM Council - start free local Ollama application on Windows
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

function Test-LocalUrl([string]$url) {
    try {
        $result = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        return ($result.StatusCode -eq 200)
    } catch {
        return $false
    }
}

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw "uv bulunamadi. Kurulum: https://docs.astral.sh/uv/"
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "Node.js/npm bulunamadi. Kurulum: https://nodejs.org/"
}

if (-not (Test-Path ".venv")) {
    uv sync
    if ($LASTEXITCODE -ne 0) { throw "Python paket kurulumu basarisiz." }
}
if (-not (Test-Path "frontend/node_modules")) {
    Push-Location frontend
    try {
        npm.cmd install
        if ($LASTEXITCODE -ne 0) { throw "Arayuz paket kurulumu basarisiz." }
    } finally {
        Pop-Location
    }
}

$ollamaUrl = "http://127.0.0.1:11434/api/tags"
if (-not (Test-LocalUrl $ollamaUrl)) {
    $ollamaExecutable = Get-Command ollama -ErrorAction SilentlyContinue
    if (-not $ollamaExecutable) {
        throw "Ollama bulunamadi. Kurulum: https://ollama.com/"
    }
    Write-Host "Yerel Ollama baslatiliyor..."
    Start-Process -FilePath $ollamaExecutable.Source -ArgumentList @("serve") -WindowStyle Hidden
    $ready = $false
    for ($i = 0; $i -lt 25; $i++) {
        Start-Sleep -Seconds 1
        if (Test-LocalUrl $ollamaUrl) {
            $ready = $true
            break
        }
    }
    if (-not $ready) { throw "Ollama servisine baglanilamadi." }
}

$models = Invoke-RestMethod -Uri $ollamaUrl -TimeoutSec 5
if (-not $models.models -or $models.models.Count -eq 0) {
    throw "Ollama uzerinde sohbet modeli bulunamadi. Komut: ollama list"
}

$repo = $PSScriptRoot.Replace("'", "''")
if (-not (Test-LocalUrl "http://127.0.0.1:8001/api/status")) {
    Write-Host "Python API baslatiliyor..."
    $backendCommand = "Set-Location -LiteralPath '$repo'; uv run python -m backend.main"
    Start-Process powershell.exe -ArgumentList @("-NoExit", "-Command", $backendCommand)
}
if (-not (Test-LocalUrl "http://127.0.0.1:5173/")) {
    Write-Host "Web arayuzu baslatiliyor..."
    $frontendCommand = "Set-Location -LiteralPath '$repo\frontend'; npm.cmd run dev -- --host 127.0.0.1 --strictPort"
    Start-Process powershell.exe -ArgumentList @("-NoExit", "-Command", $frontendCommand)
}

$ready = $false
for ($i=0; $i -lt 30; $i++) {
    if ((Test-LocalUrl "http://127.0.0.1:8001/api/status") -and
        (Test-LocalUrl "http://127.0.0.1:5173/")) {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw "Yerel uygulama baslatilamadi. Acilan iki terminali kontrol edin." }
Start-Process "http://127.0.0.1:5173/"
Write-Host "LLM Council hazir: http://127.0.0.1:5173/"
