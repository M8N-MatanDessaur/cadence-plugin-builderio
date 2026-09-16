param(
    [Parameter(Mandatory = $true)][string]$Name,
    [ValidateSet("data", "page", "component", "section")][string]$Kind = "data",
    [string]$JsonFile,
    [string]$ApiBase = $(if ($env:CADENCE_API) { $env:CADENCE_API } else { "http://127.0.0.1:3800" })
)
$CadenceHeaders = @{}
if ($env:CADENCE_TOKEN) { $CadenceHeaders["x-cadence-token"] = $env:CADENCE_TOKEN }

$body = @{ name = $Name; kind = $Kind; fields = @() }
if ($JsonFile -and (Test-Path $JsonFile)) {
    $fields = Get-Content $JsonFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $body.fields = $fields
}

$json = $body | ConvertTo-Json -Depth 10
$result = Invoke-RestMethod -Headers $CadenceHeaders "$ApiBase/api/plugins/builderio/models" -Method POST -ContentType "application/json; charset=utf-8" -Body $json
if ($result.error) { Write-Host "`n  Error: $($result.error)" -ForegroundColor Red }
else { Write-Host "`n  Created model '$Name' ($Kind)" -ForegroundColor Green; Write-Host "  ID: $($result.id)" -ForegroundColor DarkGray }
Write-Host ""
