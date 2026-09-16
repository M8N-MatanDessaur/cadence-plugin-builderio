param(
    [Parameter(Mandatory = $true)][string]$Model,
    [Parameter(Mandatory = $true)][string]$JsonFile,
    [string]$ApiBase = $(if ($env:CADENCE_API) { $env:CADENCE_API } else { "http://127.0.0.1:3800" })
)
$CadenceHeaders = @{}
if ($env:CADENCE_TOKEN) { $CadenceHeaders["x-cadence-token"] = $env:CADENCE_TOKEN }

if (-not (Test-Path $JsonFile)) { Write-Host "`n  File not found: $JsonFile`n" -ForegroundColor Red; return }
$body = Get-Content $JsonFile -Raw -Encoding UTF8
$result = Invoke-RestMethod -Headers $CadenceHeaders "$ApiBase/api/plugins/builderio/content/$Model" -Method POST -ContentType "application/json; charset=utf-8" -Body $body
if ($result.error) { Write-Host "`n  Error: $($result.error)" -ForegroundColor Red }
else { Write-Host "`n  Created entry in '$Model'" -ForegroundColor Green; Write-Host "  $($result | ConvertTo-Json -Compress)" -ForegroundColor DarkGray }
Write-Host ""
