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
  if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw 'Codex CLI fehlt. Installiere sie nach https://learn.chatgpt.com/docs/cli und starte setup.ps1 erneut.'
  }
  Write-Output 'Setup fertig. Für Live-OAuth mit pnpm login bei ChatGPT anmelden. Es wurden keine Modellaufrufe gestartet.'
} finally { Pop-Location }
