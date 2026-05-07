$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $workspaceRoot 'release-tools'
$downloadsDir = Join-Path $toolsDir 'downloads'
$ffmpegExtractDir = Join-Path $downloadsDir 'ffmpeg-extract'

New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
New-Item -ItemType Directory -Path $downloadsDir -Force | Out-Null

$ytDlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.03.17/yt-dlp.exe'
$ytDlpPath = Join-Path $toolsDir 'yt-dlp.exe'

$ffmpegVersion = '8.1.1'
$ffmpegArchiveUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$ffmpegArchivePath = Join-Path $downloadsDir 'ffmpeg-release-essentials.zip'

Invoke-WebRequest -Uri $ytDlpUrl -OutFile $ytDlpPath
Invoke-WebRequest -Uri $ffmpegArchiveUrl -OutFile $ffmpegArchivePath

if (Test-Path -LiteralPath $ffmpegExtractDir) {
    Remove-Item -LiteralPath $ffmpegExtractDir -Recurse -Force
}

Expand-Archive -LiteralPath $ffmpegArchivePath -DestinationPath $ffmpegExtractDir -Force

$ffmpegExe = Get-ChildItem -LiteralPath $ffmpegExtractDir -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
if (-not $ffmpegExe) {
    throw 'ffmpeg.exe was not found in the downloaded archive'
}

Copy-Item -LiteralPath $ffmpegExe.FullName -Destination (Join-Path $toolsDir 'ffmpeg.exe') -Force

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
} | ConvertTo-Json -Depth 4

Set-Content -LiteralPath (Join-Path $toolsDir 'manifest.json') -Value $manifest -Encoding UTF8

"Updated release-tools: yt-dlp.exe, ffmpeg.exe"
