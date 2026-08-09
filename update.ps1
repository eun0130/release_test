$ErrorActionPreference = "Stop"
$repo = "eun0130/release_test"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Checking latest release of $repo ..."
$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
$latest = $release.tag_name.TrimStart("v")

$manifestPath = Join-Path $dir "manifest.json"
$current = "0"
if (Test-Path $manifestPath) {
    $current = (Get-Content $manifestPath -Raw | ConvertFrom-Json).version
}

if ($current -eq $latest) {
    Write-Host "Already up to date (v$current). Nothing to do."
    exit 0
}

$asset = $release.assets | Where-Object { $_.name -like "*.zip" } | Select-Object -First 1
if (-not $asset) {
    Write-Host "ERROR: no zip asset found in the latest release."
    exit 1
}

Write-Host "Updating v$current -> v$latest ..."
$tmp = Join-Path $env:TEMP "release_test_update.zip"
Invoke-WebRequest $asset.browser_download_url -OutFile $tmp
Expand-Archive -Path $tmp -DestinationPath $dir -Force
Remove-Item $tmp

Write-Host ""
Write-Host "DONE. Updated to v$latest."
Write-Host "Last step: open chrome://extensions and click the reload button,"
Write-Host "or simply restart Chrome."
