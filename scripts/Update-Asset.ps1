param(
  [Parameter(Mandatory=$true)][string]$Id,
  [string]$AltText,
  [string]$Name,
  [string]$ApiBase = $(if ($env:CADENCE_API) { $env:CADENCE_API } else { "http://127.0.0.1:3800" })
)
$CadenceHeaders = @{}
if ($env:CADENCE_TOKEN) { $CadenceHeaders["x-cadence-token"] = $env:CADENCE_TOKEN }

$body = @{}
if ($PSBoundParameters.ContainsKey('AltText')) { $body.altText = $AltText }
if ($PSBoundParameters.ContainsKey('Name'))    { $body.name    = $Name }

if ($body.Count -eq 0) { Write-Host "  Nothing to update. Pass -AltText or -Name." -ForegroundColor Yellow; return }

$json = $body | ConvertTo-Json -Compress
$r = Invoke-RestMethod -Headers $CadenceHeaders -Method Patch "$ApiBase/api/plugins/builderio/assets/$Id" -ContentType 'application/json' -Body $json
if ($r.error) { Write-Host "  Error: $($r.error)" -ForegroundColor Red; return }
Write-Host "  Asset updated: $Id" -ForegroundColor Green
