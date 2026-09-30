<#
.SYNOPSIS
    Backfills vault usage from Claude Code session transcripts (main sessions and subagents).
.NOTES
    Safe to re-run: tool calls already in a usage log (by tool_use_id) are skipped.
.EXAMPLE
    pwsh -NoProfile -File Import-ClaudeHistory.ps1 -Since 2026-09-01
#>
param(
    [string]$ProjectsRoot = (Join-Path $HOME '.claude' 'projects'),
    [Nullable[datetime]]$Since,
    [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'ClaudeToolUsage.ps1')

function Import-ClaudeHistory {
    $config = Get-VaultUsageConfig -ConfigPath $ConfigPath
    $knownEventIds = Get-VaultUsageEventId -Config $config
    $transcripts = @(Get-ChildItem -LiteralPath $ProjectsRoot -Recurse -File -Filter '*.jsonl' |
        Where-Object { -not $Since -or $_.LastWriteTime -ge $Since })

    $records = @($transcripts | ForEach-Object { Import-Transcript -File $_ -Config $config -KnownEventIds $knownEventIds })

    Write-Output "Imported $($records.Count) usage records from $($transcripts.Count) transcripts."
}

function Import-Transcript {
    param(
        [Parameter(Mandatory)][IO.FileInfo]$File,
        [Parameter(Mandatory)][object]$Config,
        [Parameter(Mandatory)][AllowEmptyCollection()][Collections.Generic.HashSet[string]]$KnownEventIds
    )

    $subagent = Get-TranscriptSubagent -File $File

    Get-TranscriptToolCall -File $File -Subagent $subagent |
        Where-Object { (-not $Since -or $_.Timestamp -ge $Since) -and (Register-NewToolCall -ToolCall $_ -KnownEventIds $KnownEventIds) } |
        ForEach-Object { Add-ClaudeToolUsage -ToolCall $_ -Source 'import' -Config $Config }
}

# Returns true only the first time an id is seen, so hook-recorded and repeated transcript calls are not counted twice.
function Register-NewToolCall {
    param(
        [Parameter(Mandatory)][object]$ToolCall,
        [Parameter(Mandatory)][AllowEmptyCollection()][Collections.Generic.HashSet[string]]$KnownEventIds
    )

    return $KnownEventIds.Add($ToolCall.Id)
}

# Subagent transcripts sit next to a .meta.json that names the agent type (Explore, Plan, ...).
function Get-TranscriptSubagent {
    param([Parameter(Mandatory)][IO.FileInfo]$File)

    $metaPath = [IO.Path]::ChangeExtension($File.FullName, '.meta.json')
    if (-not (Test-Path -LiteralPath $metaPath -PathType Leaf)) {
        return $null
    }

    return (Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json).agentType
}

function Get-TranscriptToolCall {
    param(
        [Parameter(Mandatory)][IO.FileInfo]$File,
        [string]$Subagent
    )

    return Select-String -LiteralPath $File.FullName -SimpleMatch '"type":"tool_use"' |
        ForEach-Object { ConvertFrom-TranscriptLine -Line $_.Line -Subagent $Subagent }
}

function ConvertFrom-TranscriptLine {
    param(
        [Parameter(Mandatory)][string]$Line,
        [string]$Subagent
    )

    $entry = ConvertFrom-TranscriptJson -Line $Line
    if (-not $entry) {
        return
    }

    $entry.message.content |
        Where-Object { $_.type -eq 'tool_use' } |
        ForEach-Object {
            New-ClaudeToolCall -Id $_.id -Name $_.name -ToolInput $_.input -Cwd $entry.cwd `
                -Session $entry.sessionId -Subagent $Subagent -Timestamp $entry.timestamp
        }
}

function ConvertFrom-TranscriptJson {
    param([Parameter(Mandatory)][string]$Line)

    try {
        return $Line | ConvertFrom-Json -Depth 100 -DateKind Utc
    }
    catch {
        Write-Warning "Skipping unreadable transcript line: $($Line.Substring(0, [Math]::Min(120, $Line.Length)))"

        return $null
    }
}

Import-ClaudeHistory
