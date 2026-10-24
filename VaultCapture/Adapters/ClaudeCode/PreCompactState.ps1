. (Join-Path $PSScriptRoot '..' 'Shared' 'CaptureMarker.ps1')

# One marker file per session: present = the agent was already asked to save in this compaction cycle.
function Get-PreCompactConfig {
    $path = if ($env:VAULT_CAPTURE_PRECOMPACT_CONFIG) { $env:VAULT_CAPTURE_PRECOMPACT_CONFIG } else { Join-Path $PSScriptRoot 'pre-compact.config.json' }
    $config = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    $config.stateFolder = Expand-StateFolder -Path $config.stateFolder

    return $config
}
