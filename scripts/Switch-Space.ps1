param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$ApiBase = $(if ($env:CADENCE_API) { $env:CADENCE_API } else { "http://127.0.0.1:3800" })
)
$CadenceHeaders = @{}
if ($env:CADENCE_TOKEN) { $CadenceHeaders["x-cadence-token"] = $env:CADENCE_TOKEN }

$body = @{ name = $Name } | ConvertTo-Json
$result = Invoke-RestMethod -Headers $CadenceHeaders "$ApiBase/api/plugins/builderio/spaces/active" -Method POST -ContentType "application/json" -Body $body
if ($result.ok) { Write-Host "`n  Switched to space: $($result.activeSpace)" -ForegroundColor Green }
else { Write-Host "`n  Error: $($result.error)" -ForegroundColor Red }
Write-Host ""
