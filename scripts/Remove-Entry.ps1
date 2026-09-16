param(
    [Parameter(Mandatory = $true)][string]$Model,
    [Parameter(Mandatory = $true)][string]$Id,
    [switch]$Force,
    [string]$ApiBase = $(if ($env:CADENCE_API) { $env:CADENCE_API } else { "http://127.0.0.1:3800" })
)
$CadenceHeaders = @{}
if ($env:CADENCE_TOKEN) { $CadenceHeaders["x-cadence-token"] = $env:CADENCE_TOKEN }

if (-not $Force) {
    $confirm = Read-Host "  Delete entry '$Id' from '$Model'? (y/N)"
    if ($confirm -ne 'y') { Write-Host "  Cancelled.`n" -ForegroundColor DarkGray; return }
}
$result = Invoke-RestMethod -Headers $CadenceHeaders "$ApiBase/api/plugins/builderio/content/$Model/$Id" -Method DELETE
if ($result.ok) { Write-Host "`n  Deleted entry '$Id'" -ForegroundColor Green }
else { Write-Host "`n  Error: $($result | ConvertTo-Json -Compress)" -ForegroundColor Red }
Write-Host ""
