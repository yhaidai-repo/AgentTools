# How full the main conversation's context is, read from the last assistant turn of the Claude Code transcript.
function Get-ContextLimitConfig {
    $path = if ($env:VAULT_CAPTURE_CONTEXT_LIMIT_CONFIG) { $env:VAULT_CAPTURE_CONTEXT_LIMIT_CONFIG } else { Join-Path $PSScriptRoot 'context-limit.config.json' }
    $config = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    $config.stateFolder = Expand-StateFolder -Path $config.stateFolder

    return $config
}

function Get-ContextUsage {
    param(
        [Parameter(Mandatory)][string]$TranscriptPath,
        [Parameter(Mandatory)][object]$Config
    )

    $turn = Get-Content -LiteralPath $TranscriptPath -Tail $Config.transcriptTailLines |
        ForEach-Object { ConvertFrom-AssistantTurn -Line $_ } |
        Where-Object { $_ } |
        Select-Object -Last 1

    if (-not $turn) {
        return $null
    }

    $window = Get-ContextWindow -Config $Config -Model $turn.Model

    return [pscustomobject]@{
        Model   = $turn.Model
        Tokens  = $turn.Tokens
        Window  = $window
        Percent = [math]::Round($turn.Tokens * 100 / $window)
    }
}

# Subagent turns (isSidechain) have their own context, so only main-conversation turns count.
function ConvertFrom-AssistantTurn {
    param([string]$Line)

    $entry = ConvertFrom-TranscriptLine -Line $Line
    $usage = $entry.message.usage

    if ($entry.type -ne 'assistant' -or $entry.isSidechain -or -not $usage) {
        return $null
    }

    $tokens = $usage.input_tokens + $usage.cache_creation_input_tokens + $usage.cache_read_input_tokens + $usage.output_tokens

    return [pscustomobject]@{ Model = [string]$entry.message.model; Tokens = [long]$tokens }
}

function ConvertFrom-TranscriptLine {
    param([string]$Line)

    try {
        return $Line | ConvertFrom-Json
    }
    catch {
        return $null
    }
}

# The first `windows` entry whose model pattern matches; the config ends with a "*" fallback.
function Get-ContextWindow {
    param(
        [Parameter(Mandatory)][object]$Config,
        [string]$Model
    )

    $match = $Config.windows | Where-Object { $Model -like $_.model } | Select-Object -First 1

    return [long]$match.tokens
}

function Write-ContextLimitLog {
    param(
        [Parameter(Mandatory)][object]$Config,
        [Parameter(Mandatory)][string]$Session,
        [Parameter(Mandatory)][object]$Usage
    )

    $entry = [ordered]@{
        ts      = (Get-Date).ToUniversalTime().ToString('o')
        session = $Session
        model   = $Usage.Model
        tokens  = $Usage.Tokens
        window  = $Usage.Window
        percent = $Usage.Percent
    }

    New-Item -ItemType Directory -Path $Config.stateFolder -Force | Out-Null
    Add-Content -LiteralPath (Join-Path $Config.stateFolder 'warnings.jsonl') -Value ($entry | ConvertTo-Json -Compress)
}
