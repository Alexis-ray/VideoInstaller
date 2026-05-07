$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$portableRoot = Join-Path $workspaceRoot 'release\VideoInstaller-win-x64'
$installerScript = Join-Path $PSScriptRoot 'installer.iss'
$isccCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
    'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
    'C:\Program Files\Inno Setup 6\ISCC.exe'
)

if (-not (Test-Path -LiteralPath $portableRoot)) {
    throw 'Missing portable release directory. Run npm run release:portable first.'
}

$isccPath = $isccCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $isccPath) {
    throw 'ISCC.exe was not found. Install Inno Setup 6 first.'
}

& $isccPath $installerScript

"Installer built: release\\VideoInstaller-Setup.exe"
