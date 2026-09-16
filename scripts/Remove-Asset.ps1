param(
  [Parameter(Mandatory=$true)][string]$Id,
  [switch]$Force,
  [string]$ApiBase = $(if ($env:CADENCE_API) { $env:CADENCE_API } else { "http://127.0.0.1:3800" })
)
$CadenceHeaders = @{}
if ($env:CADENCE_TOKEN) { $CadenceHeaders["x-cadence-token"] = $env:CADENCE_TOKEN }

if (-not $Force) {
  $ans = Read-Host "Delete asset $Id? (yes/no)"
  if ($ans -ne 'yes') { Write-Host "Cancelled." -ForegroundColor Yellow; return }
}

$r = Invoke-RestMethod -Headers $CadenceHeaders -Method Delete "$ApiBase/api/plugins/builderio/assets/$Id"
if ($r.error) { Write-Host "  Error: $($r.error)" -ForegroundColor Red; return }
Write-Host "  Asset deleted: $Id" -ForegroundColor Green
