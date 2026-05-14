param(
    [Parameter(Mandatory = $true)][string]$ExePath,
    [Parameter(Mandatory = $true)][string]$IconPath,
    [Parameter(Mandatory = $true)][string]$RcEditPath
)

$ErrorActionPreference = 'Stop'

foreach ($path in @($ExePath, $IconPath, $RcEditPath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing required path: $path"
    }
}

& $RcEditPath $ExePath --set-icon $IconPath
if ($LASTEXITCODE -ne 0) {
    throw "Failed to set icon for $ExePath"
}

"Updated executable icon: $ExePath"
