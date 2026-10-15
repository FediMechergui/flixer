$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$taskLog = Join-Path $taskRoot 'artifacts/hdtoday-refresh-task.log'
New-Item -ItemType Directory -Path (Split-Path -Parent $taskLog) -Force | Out-Null
"HDToday refresh started: $(Get-Date -Format o)" | Out-File -LiteralPath $taskLog -Append -Encoding utf8
& node.exe (Join-Path $PSScriptRoot 'refresh-hdtoday.js') --pages 12 --publish *>> $taskLog
if ($LASTEXITCODE -ne 0) { throw 'HDToday refresh failed; the previous published snapshot remains available.' }
& gh.exe workflow run refresh.yml --repo FediMechergui/flixer --ref main *>> $taskLog
if ($LASTEXITCODE -ne 0) { throw 'Snapshot published, but hosted refresh could not be requested.' }
