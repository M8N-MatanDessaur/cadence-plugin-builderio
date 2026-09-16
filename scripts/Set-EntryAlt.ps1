param(
  [Parameter(Mandatory=$true)][string]$Url,
  [Parameter(Mandatory=$true)][string]$Model,
  [Parameter(Mandatory=$true)][string]$EntryId,
  [Parameter(Mandatory=$true)][string]$AltText,
  [string]$ApiBase = $(if ($env:CADENCE_API) { $env:CADENCE_API } else { "http://127.0.0.1:3800" })
)
$CadenceHeaders = @{}
if ($env:CADENCE_TOKEN) { $CadenceHeaders["x-cadence-token"] = $env:CADENCE_TOKEN }

$json = @{ url = $Url; model = $Model; entryId = $EntryId; altText = $AltText } | ConvertTo-Json -Compress
$r = Invoke-RestMethod -Headers $CadenceHeaders -Method Patch "$ApiBase/api/plugins/builderio/asset-usage" -ContentType 'application/json' -Body $json
if ($r.error) { Write-Host "  Error: $($r.error)" -ForegroundColor Red; return }
Write-Host "  Updated $($r.updated) location(s) in $Model/$EntryId" -ForegroundColor Green
