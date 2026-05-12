$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$solutionPath = Join-Path $workspaceRoot 'desktop-native\VideoInstaller.Desktop.sln'
$projectPath = Join-Path $workspaceRoot 'desktop-native\src\VideoInstaller.Desktop\VideoInstaller.Desktop.csproj'
$packageJsonPath = Join-Path $workspaceRoot 'package.json'
$toolsSourceRoot = Join-Path $workspaceRoot 'release-tools'
$releaseRoot = Join-Path $workspaceRoot 'release'
$stagingRoot = Join-Path $workspaceRoot 'release-build\native-portable'
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$appVersion = $packageJson.version
$portableName = "VideoInstaller-v$appVersion-win-x64"
$portableRoot = Join-Path $releaseRoot $portableName
$publishRoot = Join-Path $stagingRoot 'publish'
$zipPath = Join-Path $releaseRoot "$portableName.zip"

foreach ($requiredPath in @($solutionPath, $projectPath, $toolsSourceRoot)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Missing required path: $requiredPath"
    }
}

foreach ($requiredTool in @('yt-dlp.exe', 'ffmpeg.exe', 'js-runtime\deno.exe')) {
    $toolPath = Join-Path $toolsSourceRoot $requiredTool
    if (-not (Test-Path -LiteralPath $toolPath)) {
        throw "Missing release tool $requiredTool. Run scripts/download-release-tools.ps1 first."
    }
}

if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

if (Test-Path -LiteralPath $portableRoot) {
    Remove-Item -LiteralPath $portableRoot -Recurse -Force
}

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

dotnet restore $solutionPath
if ($LASTEXITCODE -ne 0) {
    throw 'dotnet restore failed'
}

dotnet test $solutionPath
if ($LASTEXITCODE -ne 0) {
    throw 'dotnet test failed'
}

dotnet publish $projectPath -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o $publishRoot
if ($LASTEXITCODE -ne 0) {
    throw 'dotnet publish failed'
}

Copy-Item -LiteralPath $publishRoot -Destination $portableRoot -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $portableRoot 'tools') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $portableRoot 'tools\js-runtime') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $portableRoot 'tmp') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $portableRoot 'logs') -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $toolsSourceRoot 'yt-dlp.exe') -Destination (Join-Path $portableRoot 'tools\yt-dlp.exe') -Force
Copy-Item -LiteralPath (Join-Path $toolsSourceRoot 'ffmpeg.exe') -Destination (Join-Path $portableRoot 'tools\ffmpeg.exe') -Force
Copy-Item -LiteralPath (Join-Path $toolsSourceRoot 'js-runtime\deno.exe') -Destination (Join-Path $portableRoot 'tools\js-runtime\deno.exe') -Force

$portableConfig = @{
    runtimeMode = 'portable'
    tmpDir = 'tmp'
    cookie = 'cookies.txt'
    proxy = ''
    proxyFallbackDirect = $true
    ytDlpPath = 'tools/yt-dlp.exe'
    ffmpegPath = 'tools/ffmpeg.exe'
    jsRuntimePath = 'tools/js-runtime/deno.exe'
    thumbnailTimeout = 8000
    taskTimeout = @{
        parse = 60000
        download = 3600000
    }
    diskCleanupThreshold = 90
} | ConvertTo-Json -Depth 4
Set-Content -LiteralPath (Join-Path $portableRoot 'config.json') -Value $portableConfig -Encoding UTF8

$cookiesTemplate = @(
    '# Netscape HTTP Cookie File',
    '# Replace this file with exported browser cookies if needed.',
    ''
)
Set-Content -LiteralPath (Join-Path $portableRoot 'cookies.txt') -Value $cookiesTemplate -Encoding ASCII

$releaseNotes = @(
    "VideoInstaller v$appVersion",
    'Native Windows desktop release.',
    'Primary release line for VideoInstaller on Windows.',
    'No browser UI, no Node.js runtime, no WebView.',
    'Bundled tools: yt-dlp, ffmpeg, and Deno JavaScript runtime for YouTube extraction.',
    'Portable mode writes config, cookies, logs, and downloads into the release folder itself.',
    'Installed mode writes config, cookies, tmp, and logs into %LOCALAPPDATA%\VideoInstaller.',
    'Legacy Web assets remain available separately as compatibility builds.'
)
Set-Content -LiteralPath (Join-Path $portableRoot 'release-notes.txt') -Value $releaseNotes -Encoding UTF8

Compress-Archive -LiteralPath $portableRoot -DestinationPath $zipPath -CompressionLevel Optimal

"Portable release built: $portableRoot"
"Portable zip built: $zipPath"
