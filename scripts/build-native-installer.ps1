$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $workspaceRoot 'package.json'
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = $packageJson.version
$portableRoot = Join-Path $workspaceRoot ("release\VideoInstaller-v{0}-win-x64" -f $version)
$portableScript = Join-Path $PSScriptRoot 'build-native-portable.ps1'
$installerScript = Join-Path $PSScriptRoot 'installer-native.iss'
$isccCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
    'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
    'C:\Program Files\Inno Setup 6\ISCC.exe'
)

if (-not (Test-Path -LiteralPath $portableRoot)) {
    & $portableScript
    if (-not $?) {
        throw 'Portable build failed'
    }
}

if (-not (Test-Path -LiteralPath $installerScript)) {
    throw "Missing installer script: $installerScript"
}

$isccPath = $isccCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $isccPath) {
    throw 'ISCC.exe was not found. Install Inno Setup 6 first.'
}

& $isccPath "/DMyAppVersion=$version" "/DMyPortableRootName=VideoInstaller-v$version-win-x64" "/DMyOutputBaseFilename=VideoInstaller-v$version-win-x64-setup" $installerScript
if ($LASTEXITCODE -ne 0) {
    throw 'Inno Setup build failed'
}

"Installer built: release\VideoInstaller-v$version-win-x64-setup.exe"
