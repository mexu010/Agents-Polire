$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
try {
  foreach ($taskCheck in @('build','lint','test')) {
    pnpm run $taskCheck
    if ($LASTEXITCODE -ne 0) { throw "Prüfung fehlgeschlagen: $taskCheck" }
  }
} finally { Pop-Location }
