param(
    [Parameter(Mandatory = $true)][string]$Model,
    [Parameter(Mandatory = $true)][string]$Id,
    [string]$ApiBase = $(if ($env:CADENCE_API) { $env:CADENCE_API } else { "http://127.0.0.1:3800" })
)
$CadenceHeaders = @{}
if ($env:CADENCE_TOKEN) { $CadenceHeaders["x-cadence-token"] = $env:CADENCE_TOKEN }

$result = Invoke-RestMethod -Headers $CadenceHeaders "$ApiBase/api/plugins/builderio/content/$Model/$Id/unpublish" -Method POST
if ($result.ok) { Write-Host "`n  Unpublished entry '$Id' in '$Model'" -ForegroundColor Green }
else { Write-Host "`n  Error: $($result.error)" -ForegroundColor Red }
Write-Host ""
