param([switch]$Silent)

$ErrorActionPreference = "Stop"
$repo = "eun0130/release_test"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Show-Toast($title, $message) {
    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $texts = $template.GetElementsByTagName("text")
        $texts.Item(0).AppendChild($template.CreateTextNode($title)) | Out-Null
        $texts.Item(1).AppendChild($template.CreateTextNode($message)) | Out-Null
        $toast = New-Object Windows.UI.Notifications.ToastNotification($template)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Release Test").Show($toast)
    } catch {}
}

function Say($message) {
    if (-not $Silent) { Write-Host $message }
}

try {
    Say "Checking latest release of $repo ..."
    $release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
    $latest = $release.tag_name.TrimStart("v")

    $manifestPath = Join-Path $dir "manifest.json"
    $current = "0"
    if (Test-Path $manifestPath) {
        $current = (Get-Content $manifestPath -Raw | ConvertFrom-Json).version
    }

    if ($current -eq $latest) {
        Say "Already up to date (v$current)."
        exit 0
    }

    $asset = $release.assets | Where-Object { $_.name -like "*.zip" } | Select-Object -First 1
    if (-not $asset) { throw "no zip asset in the latest release" }

    Say "Updating v$current -> v$latest ..."
    $tmp = Join-Path $env:TEMP "release_test_update.zip"
    Invoke-WebRequest $asset.browser_download_url -OutFile $tmp
    Expand-Archive -Path $tmp -DestinationPath $dir -Force
    Remove-Item $tmp

    Say "DONE. Updated to v$latest."
    Show-Toast "Release Test 업데이트 완료" "v$current → v$latest 적용 준비됨. 크롬을 재시작하면 반영됩니다."
} catch {
    Say "Update failed: $_"
    Show-Toast "Release Test 업데이트 실패" "인터넷 연결을 확인해 주세요. 다음에 다시 시도합니다."
    exit 1
}
