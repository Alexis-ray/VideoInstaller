$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $workspaceRoot 'package.json'
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = $packageJson.version
$portableRoot = Join-Path $workspaceRoot ("release\VideoInstaller-legacy-v{0}-win-x64" -f $version)
$portableScript = Join-Path $PSScriptRoot 'build-portable.ps1'
$installerScript = Join-Path $PSScriptRoot 'installer.iss'
$syncIconsScript = Join-Path $PSScriptRoot 'sync-icons.ps1'
$isccCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
    'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
    'C:\Program Files\Inno Setup 6\ISCC.exe'
)

if (-not (Test-Path -LiteralPath $syncIconsScript)) {
    throw "Missing icon sync script: $syncIconsScript"
}

& $syncIconsScript
if (-not $?) {
    throw 'Icon sync failed'
}

if (-not (Test-Path -LiteralPath $portableRoot)) {
    if (-not (Test-Path -LiteralPath $portableScript)) {
        throw "Missing portable build script: $portableScript"
    }

    & $portableScript
    if (-not $?) {
        throw 'Portable build failed'
    }
}

$isccPath = $isccCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $isccPath) {
    throw 'ISCC.exe was not found. Install Inno Setup 6 first.'
}

& $isccPath "/DMyAppVersion=$version" "/DMyPortableRootName=VideoInstaller-legacy-v$version-win-x64" "/DMyOutputBaseFilename=VideoInstaller-legacy-v$version-win-x64-setup" $installerScript

if ($LASTEXITCODE -ne 0) {
    throw 'Inno Setup build failed'
}

"Installer built: release\\VideoInstaller-legacy-v$version-win-x64-setup.exe"
