$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$sourceIcon = Join-Path $workspaceRoot 'assets\icons\app.ico'
$targets = @(
    (Join-Path $workspaceRoot 'desktop-native\src\VideoInstaller.Desktop\Assets\app.ico'),
    (Join-Path $workspaceRoot 'static\favicon.ico')
)

if (-not (Test-Path -LiteralPath $sourceIcon)) {
    throw "Missing icon source: $sourceIcon"
}

foreach ($target in $targets) {
    $targetParent = Split-Path -Parent $target
    if (-not (Test-Path -LiteralPath $targetParent)) {
        throw "Missing icon target directory: $targetParent"
    }

    Copy-Item -LiteralPath $sourceIcon -Destination $target -Force
}

"Synchronized icon source assets\icons\app.ico to desktop-native and static favicon targets."
