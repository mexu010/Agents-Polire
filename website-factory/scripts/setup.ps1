$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Push-Location -LiteralPath $taskRoot
try {
  node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
  if ($LASTEXITCODE -ne 0) { throw 'Node.js 24 oder neuer erforderlich.' }
  pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'Paketinstallation fehlgeschlagen.' }
  pnpm exec playwright install chromium
  if ($LASTEXITCODE -ne 0) { throw 'Browserinstallation fehlgeschlagen.' }
  if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
  Write-Output 'Setup fertig. Zugangsdaten ausschliesslich lokal in .env eintragen. Es wurden keine Modellaufrufe gestartet.'
} finally { Pop-Location }
