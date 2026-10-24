. (Join-Path $PSScriptRoot '..' 'Shared' 'CaptureMarker.ps1')
. (Join-Path $PSScriptRoot '..' 'ClaudeCode' 'ContextUsage.ps1')

function Get-CodexContextLimitConfig {
    $path = if ($env:VAULT_CAPTURE_CODEX_CONTEXT_LIMIT_CONFIG) { $env:VAULT_CAPTURE_CODEX_CONTEXT_LIMIT_CONFIG } else { Join-Path $PSScriptRoot 'context-limit.config.json' }
    $config = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    $config.stateFolder = Expand-StateFolder -Path $config.stateFolder

    return $config
}

function Get-CodexContextUsage {
    param(
        [Parameter(Mandatory)][string]$TranscriptPath,
        [Parameter(Mandatory)][object]$Config
    )

    $usage = Get-Content -LiteralPath $TranscriptPath -Tail $Config.transcriptTailLines |
        ForEach-Object { ConvertFrom-CodexTokenCount -Line $_ } |
        Where-Object { $_ } |
        Select-Object -Last 1

    return $usage
}

function ConvertFrom-CodexTokenCount {
    param([string]$Line)

    $entry = ConvertFrom-TranscriptLine -Line $Line
    $info = $entry.payload.info

    if ($entry.type -ne 'event_msg' -or $entry.payload.type -ne 'token_count' -or -not $info) {
        return $null
    }

    $tokens = $info.last_token_usage.total_tokens
    $window = $info.model_context_window

    if ($tokens -isnot [ValueType] -or $window -isnot [ValueType]) {
        return $null
    }

    if (-not [double]::IsFinite([double]$tokens) -or -not [double]::IsFinite([double]$window) -or $tokens -lt 0 -or $window -le 0) {
        return $null
    }

    return [pscustomobject]@{
        Model = 'codex'
        Tokens = [long]$tokens
        Window = [long]$window
        Percent = [math]::Round($tokens * 100.0 / $window)
    }
}
