$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $workspaceRoot 'release'
$releaseBuildRoot = Join-Path $workspaceRoot 'release-build'

foreach ($path in @($releaseRoot, $releaseBuildRoot)) {
    if (-not (Test-Path -LiteralPath $path)) {
        continue
    }

    Get-ChildItem -LiteralPath $path -Force | ForEach-Object {
        if ($_.PSIsContainer) {
            Remove-Item -LiteralPath $_.FullName -Recurse -Force
            return
        }

        Remove-Item -LiteralPath $_.FullName -Force
    }
}

"Cleared local release outputs from release/ and release-build/."
