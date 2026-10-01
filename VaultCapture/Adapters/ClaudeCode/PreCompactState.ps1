# One marker file per session: present = the agent was already asked to save in this compaction cycle.
function Get-PreCompactConfig {
    $path = if ($env:VAULT_CAPTURE_PRECOMPACT_CONFIG) { $env:VAULT_CAPTURE_PRECOMPACT_CONFIG } else { Join-Path $PSScriptRoot 'pre-compact.config.json' }
    $config = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    $config.stateFolder = Expand-StateFolder -Path $config.stateFolder

    return $config
}

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
