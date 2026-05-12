$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $workspaceRoot 'package.json'
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = $packageJson.version
$portableName = "VideoInstaller-legacy-v$version-win-x64"

$releaseRoot = Join-Path $workspaceRoot 'release'
$buildRoot = Join-Path $workspaceRoot 'release-build'
$portableRoot = Join-Path $releaseRoot $portableName
$toolsSourceRoot = Join-Path $workspaceRoot 'release-tools'
$toolsTargetRoot = Join-Path $portableRoot 'tools'
$exeOutput = Join-Path $buildRoot 'VideoInstaller.exe'
$pkgFetchLogPath = Join-Path $workspaceRoot 'node_modules\pkg-fetch\lib-es5\log.js'

if (-not (Test-Path -LiteralPath $toolsSourceRoot)) {
    throw 'Missing release-tools directory. Run npm run release:tools first.'
}

foreach ($requiredTool in @('yt-dlp.exe', 'ffmpeg.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $toolsSourceRoot $requiredTool))) {
        throw "Missing release tool $requiredTool. Run npm run release:tools first."
    }
}

if (Test-Path -LiteralPath $buildRoot) {
    Remove-Item -LiteralPath $buildRoot -Recurse -Force
}

if (Test-Path -LiteralPath $portableRoot) {
    Remove-Item -LiteralPath $portableRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
New-Item -ItemType Directory -Path $portableRoot -Force | Out-Null
New-Item -ItemType Directory -Path $toolsTargetRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $portableRoot 'tmp') -Force | Out-Null

# pkg 5.8.1 can assert while re-enabling the download progress bar on Windows.
# Patch the local build dependency in place so release builds stay reproducible.
if (Test-Path -LiteralPath $pkgFetchLogPath) {
    $pkgFetchLog = Get-Content -LiteralPath $pkgFetchLogPath -Raw
    $patchedPkgFetchLog = $pkgFetchLog.Replace('(0, assert_1.default)(!this.bar);', 'if (this.bar) { this.disableProgress(); }')
    if ($patchedPkgFetchLog -ne $pkgFetchLog) {
        Set-Content -LiteralPath $pkgFetchLogPath -Value $patchedPkgFetchLog -Encoding UTF8
    }
}

$env:CI = '1'
npx pkg . --targets node18-win-x64 --output $exeOutput
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $exeOutput)) {
    throw 'pkg failed to build VideoInstaller.exe'
}

Copy-Item -LiteralPath $exeOutput -Destination (Join-Path $portableRoot 'VideoInstaller.exe') -Force
Copy-Item -LiteralPath (Join-Path $workspaceRoot 'static') -Destination (Join-Path $portableRoot 'static') -Recurse -Force
Copy-Item -LiteralPath (Join-Path $toolsSourceRoot 'yt-dlp.exe') -Destination (Join-Path $toolsTargetRoot 'yt-dlp.exe') -Force
Copy-Item -LiteralPath (Join-Path $toolsSourceRoot 'ffmpeg.exe') -Destination (Join-Path $toolsTargetRoot 'ffmpeg.exe') -Force

$portableConfig = @{
    port = 2878
    address = '127.0.0.1'
    runtimeMode = 'portable'
    tmpDir = 'tmp'
    cookie = 'cookies.txt'
    disable = $false
    proxy = ''
    proxyFallbackDirect = $true
    ytDlpPath = 'tools/yt-dlp.exe'
    ffmpegPath = 'tools/ffmpeg.exe'
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

$manifest = @{
    name = 'VideoInstaller'
    version = $version
    releaseLine = 'legacy-web'
    runtimeMode = 'portable'
    entry = 'VideoInstaller.exe'
    generatedAt = (Get-Date).ToString('s')
} | ConvertTo-Json -Depth 3
Set-Content -LiteralPath (Join-Path $portableRoot 'release-manifest.json') -Value $manifest -Encoding UTF8

"Portable release built: $(Join-Path $portableRoot 'VideoInstaller.exe')"
