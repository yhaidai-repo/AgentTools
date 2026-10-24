function Expand-StateFolder {
    param([Parameter(Mandatory)][string]$Path)

    if ($Path -match '^~[\\/]') {
        return Join-Path $HOME $Path.Substring(2)
    }

    return $Path
}

function Get-MarkerPath {
    param(
        [Parameter(Mandatory)][object]$Config,
        [Parameter(Mandatory)][string]$Session
    )

    $safeSession = $Session -replace '[^\w-]', '_'

    return Join-Path $Config.stateFolder "$safeSession.marker"
}

function Test-CaptureRequested {
    param(
        [Parameter(Mandatory)][object]$Config,
        [Parameter(Mandatory)][string]$Session
    )

    $markerPath = Get-MarkerPath -Config $Config -Session $Session
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        return $false
    }

    $markerAge = (Get-Date) - (Get-Item -LiteralPath $markerPath).LastWriteTime

    return $markerAge.TotalMinutes -lt $Config.markerTtlMinutes
}

function Set-CaptureRequested {
    param(
        [Parameter(Mandatory)][object]$Config,
        [Parameter(Mandatory)][string]$Session
    )

    New-Item -ItemType Directory -Path $Config.stateFolder -Force | Out-Null
    Set-Content -LiteralPath (Get-MarkerPath -Config $Config -Session $Session) -Value (Get-Date).ToString('o')
}

function Clear-CaptureRequested {
    param(
        [Parameter(Mandatory)][object]$Config,
        [Parameter(Mandatory)][string]$Session
    )

    Remove-Item -LiteralPath (Get-MarkerPath -Config $Config -Session $Session) -Force -ErrorAction SilentlyContinue
}
