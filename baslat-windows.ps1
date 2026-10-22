# LLM Council - Windows local Ollama launcher
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw "uv yuklu degil: https://docs.astral.sh/uv/"
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "Node.js/npm yuklu degil: https://nodejs.org/"
}
if (-not (Test-Path ".venv")) {
    uv sync
    if ($LASTEXITCODE -ne 0) { throw "Python kurulumunda hata." }
}
if (-not (Test-Path "frontend/node_modules")) {
    Push-Location frontend
    try {
        npm.cmd install
        if ($LASTEXITCODE -ne 0) { throw "Frontend kurulumunda hata." }
    } finally {
        Pop-Location
    }
}
try {
    $tags = Invoke-RestMethod "http://127.0.0.1:11434/api/tags" -TimeoutSec 5
    if (-not $tags.models -or $tags.models.Count -eq 0) {
        Write-Warning "Ollama calisiyor ancak kurulu model bulunamadi. 'ollama list' ile kontrol edin."
    }
} catch {
    throw "Ollama API su anda calismiyor. Ollama'yi baslatin ve tekrar deneyin."
}

$repo = $PSScriptRoot.Replace("'", "''")
$backendCommand = "Set-Location -LiteralPath '$repo'; uv run python -m backend.main"
$frontendCommand = "Set-Location -LiteralPath '$repo\frontend'; npm.cmd run dev"
Start-Process powershell.exe -ArgumentList @("-NoExit", "-Command", $backendCommand)
Start-Process powershell.exe -ArgumentList @("-NoExit", "-Command", $frontendCommand)
Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"
Write-Host "Local LLM Council baslatiliyor: http://localhost:5173"
