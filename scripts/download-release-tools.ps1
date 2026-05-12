$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $workspaceRoot 'release-tools'
$downloadsDir = Join-Path $toolsDir 'downloads'
$ffmpegExtractDir = Join-Path $downloadsDir 'ffmpeg-extract'

New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
New-Item -ItemType Directory -Path $downloadsDir -Force | Out-Null

function Save-UrlWithRetry {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$OutFile,
        [int]$MaxAttempts = 3
    )

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            Invoke-WebRequest -Uri $Uri -OutFile $OutFile
            return
        }
        catch {
            if ($attempt -eq $MaxAttempts) {
                throw "Failed to download $Uri after $MaxAttempts attempts: $($_.Exception.Message)"
            }

            Start-Sleep -Seconds (2 * $attempt)
        }
    }
}

$ytDlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.03.17/yt-dlp.exe'
$ytDlpPath = Join-Path $toolsDir 'yt-dlp.exe'

$ffmpegVersion = '8.1.1'
$ffmpegArchiveUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$ffmpegArchivePath = Join-Path $downloadsDir 'ffmpeg-release-essentials.zip'
$denoRelease = Invoke-RestMethod -Uri 'https://api.github.com/repos/denoland/deno/releases/latest'
$denoVersion = $denoRelease.tag_name
$denoAsset = $denoRelease.assets | Where-Object { $_.name -eq 'deno-x86_64-pc-windows-msvc.zip' } | Select-Object -First 1
if (-not $denoAsset) {
    throw 'deno-x86_64-pc-windows-msvc.zip was not found in the latest Deno release'
}
$denoArchiveUrl = $denoAsset.browser_download_url
$denoArchivePath = Join-Path $downloadsDir 'deno-x86_64-pc-windows-msvc.zip'
$denoExtractDir = Join-Path $downloadsDir 'deno-extract'

Save-UrlWithRetry -Uri $ytDlpUrl -OutFile $ytDlpPath
Save-UrlWithRetry -Uri $ffmpegArchiveUrl -OutFile $ffmpegArchivePath
Save-UrlWithRetry -Uri $denoArchiveUrl -OutFile $denoArchivePath

if (Test-Path -LiteralPath $ffmpegExtractDir) {
    Remove-Item -LiteralPath $ffmpegExtractDir -Recurse -Force
}

Expand-Archive -LiteralPath $ffmpegArchivePath -DestinationPath $ffmpegExtractDir -Force

$ffmpegExe = Get-ChildItem -LiteralPath $ffmpegExtractDir -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
if (-not $ffmpegExe) {
    throw 'ffmpeg.exe was not found in the downloaded archive'
}

Copy-Item -LiteralPath $ffmpegExe.FullName -Destination (Join-Path $toolsDir 'ffmpeg.exe') -Force

if (Test-Path -LiteralPath $denoExtractDir) {
    Remove-Item -LiteralPath $denoExtractDir -Recurse -Force
}

Expand-Archive -LiteralPath $denoArchivePath -DestinationPath $denoExtractDir -Force
$denoExe = Get-ChildItem -LiteralPath $denoExtractDir -Recurse -Filter 'deno.exe' | Select-Object -First 1
if (-not $denoExe) {
    throw 'deno.exe was not found in the downloaded archive'
}

New-Item -ItemType Directory -Path (Join-Path $toolsDir 'js-runtime') -Force | Out-Null
Copy-Item -LiteralPath $denoExe.FullName -Destination (Join-Path $toolsDir 'js-runtime\deno.exe') -Force

$manifest = @{
    ytDlp = @{
        url = $ytDlpUrl
        output = 'release-tools/yt-dlp.exe'
    }
    ffmpeg = @{
        version = $ffmpegVersion
        url = $ffmpegArchiveUrl
        output = 'release-tools/ffmpeg.exe'
    }
    jsRuntime = @{
        name = 'deno'
        version = $denoVersion
        url = $denoArchiveUrl
        output = 'release-tools/js-runtime/deno.exe'
    }
} | ConvertTo-Json -Depth 4

Set-Content -LiteralPath (Join-Path $toolsDir 'manifest.json') -Value $manifest -Encoding UTF8

"Updated release-tools: yt-dlp.exe, ffmpeg.exe, js-runtime\deno.exe"
