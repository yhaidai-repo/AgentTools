# Connect the desktop user's chat histories to the backend through read-only compose mounts.
# No login files or runner sessions are copied. Safe to rerun; custom values already in .env are retained.
param([string]$CodexHistory, [string]$ClaudeSessions, [string]$EnvFile)

$ErrorActionPreference = 'Stop'
$powerloomFolder = Split-Path -Parent $PSScriptRoot
$envPath = if ($EnvFile) { [IO.Path]::GetFullPath($EnvFile) } else { Join-Path $powerloomFolder '.env' }
$explicitCodex = [bool]$CodexHistory
$explicitClaude = [bool]$ClaudeSessions

if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
    throw 'Create .env from .env.example or run install.ps1 first.'
}

$fallback = Join-Path $powerloomFolder 'desktop-chats'
$codexFallback = Join-Path $fallback 'codex'
$claudeFallback = Join-Path $fallback 'claude'
New-Item -ItemType Directory -Force -Path (Join-Path $codexFallback 'sessions'), $claudeFallback | Out-Null
$indexFallback = Join-Path $codexFallback 'session_index.jsonl'
if (-not (Test-Path -LiteralPath $indexFallback)) {
    New-Item -ItemType File -Path $indexFallback | Out-Null
}

if (-not $CodexHistory) { $CodexHistory = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex' }
if (-not $ClaudeSessions) {
    $candidates = @(
        (Join-Path $env:APPDATA 'Claude/claude-code-sessions')
        (Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Claude-Data/*/claude-code-sessions') -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
    )
    $ClaudeSessions = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Container } | Select-Object -First 1
}

$sessions = Join-Path $CodexHistory 'sessions'
$index = Join-Path $CodexHistory 'session_index.jsonl'
$values = [ordered]@{
    CODEX_DESKTOP_SESSIONS_PATH = $(if (Test-Path -LiteralPath $sessions -PathType Container) { $sessions } else { Join-Path $codexFallback 'sessions' })
    CODEX_DESKTOP_INDEX_PATH = $(if (Test-Path -LiteralPath $index -PathType Leaf) { $index } else { $indexFallback })
    CLAUDE_DESKTOP_SESSIONS_PATH = $(if ($ClaudeSessions) { $ClaudeSessions } else { $claudeFallback })
}

$text = Get-Content -Raw -LiteralPath $envPath
foreach ($key in $values.Keys) {
    $path = [IO.Path]::GetFullPath($values[$key]).Replace('\', '/')
    $line = "$key='$($path.Replace("'", "\'"))'"
    $match = "(?m)^$key=[^\r\n]*"
    if ($text -match $match) {
        $current = ($Matches[0] -replace '^[^=]*=', '').Trim().Trim("'", '"').Replace('\', '/')
        $fallbackPath = [IO.Path]::GetFullPath($fallback).Replace('\', '/').TrimEnd('/') + '/'
        $explicit = if ($key -eq 'CLAUDE_DESKTOP_SESSIONS_PATH') { $explicitClaude } else { $explicitCodex }
        # Replace our relative/absolute fallbacks, or an explicitly supplied path; retain other custom paths.
        if ($explicit -or $current.StartsWith('./desktop-chats/') -or $current.StartsWith($fallbackPath, [StringComparison]::OrdinalIgnoreCase)) {
            $text = [regex]::Replace($text, $match, [System.Text.RegularExpressions.MatchEvaluator]{ param($entry) $line })
        }
    } else {
        $text = $text.TrimEnd() + "`n$line`n"
    }
}
Set-Content -LiteralPath $envPath -Value $text -NoNewline
Write-Host 'Desktop chat history paths configured. Recreate the powerloom service to apply its read-only mounts.'
