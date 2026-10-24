# Shared by the Claude Code hook and the history import: maps one Claude tool call to vault usage records.
Import-Module (Join-Path $PSScriptRoot '..' '..' 'VaultUsage.psd1')
. (Join-Path $PSScriptRoot 'Models' 'New-ToolFileUse.ps1')
. (Join-Path $PSScriptRoot 'Models' 'New-ClaudeToolCall.ps1')

$script:ClaudeAgentName = 'claude-code'
$script:DefaultWriteWindowSeconds = 15

function Add-ClaudeToolUsage {
    param(
        [Parameter(Mandatory)][object]$ToolCall,
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][object]$Config
    )

    $fileUses = @(ConvertFrom-ClaudeToolCall -ToolCall $ToolCall -Config $Config | Where-Object { $_.Paths.Count -gt 0 })

    foreach ($fileUse in $fileUses) {
        Add-VaultUsage -Path $fileUse.Paths -Kind $fileUse.Kind -Agent $script:ClaudeAgentName -Subagent $ToolCall.Subagent `
            -Session $ToolCall.Session -Source $Source -EventId $ToolCall.Id -Timestamp $ToolCall.Timestamp `
            -Cwd $ToolCall.Cwd -Config $Config
    }
}

# Agents in these vaults read notes mostly through Bash (cat, head, sed), so shell commands are scanned for note paths.
function ConvertFrom-ClaudeToolCall {
    param(
        [Parameter(Mandatory)][object]$ToolCall,
        [Parameter(Mandatory)][object]$Config
    )

    $toolInput = $ToolCall.ToolInput

    switch -Regex ($ToolCall.Name) {
        '^Read$' {
            return New-ToolFileUse -Kind 'read' -Paths $toolInput.file_path
        }
        '^(Edit|MultiEdit|Write)$' {
            return New-ToolFileUse -Kind 'write' -Paths $toolInput.file_path
        }
        '^Grep$' {
            return New-ToolFileUse -Kind 'search' -Paths $toolInput.path
        }
        '^(Bash|PowerShell)$' {
            return ConvertFrom-ShellToolCall -ToolCall $ToolCall -Config $Config
        }
    }

    return $null
}

# Live hook only: a note the command modified is a write, whether it was named in the command or printed by it
# (sed -i, redirects, vault tools that print the path they wrote). The history import has no output and files
# have changed since, so there every note named in the command stays "shell".
function ConvertFrom-ShellToolCall {
    param(
        [Parameter(Mandatory)][object]$ToolCall,
        [Parameter(Mandatory)][object]$Config
    )

    $commandPaths = @(Find-VaultFileReference -Text ([string]$ToolCall.ToolInput.command) -Cwd $ToolCall.Cwd -Config $Config)
    if ($null -eq $ToolCall.ToolResponse) {
        return New-ToolFileUse -Kind 'shell' -Paths $commandPaths
    }

    $outputPaths = @(Find-VaultFileReference -Text (ConvertTo-ResponseText -Response $ToolCall.ToolResponse) -Cwd $ToolCall.Cwd -Config $Config)
    $writeWindowSeconds = Get-WriteWindowSeconds -Config $Config
    $writtenPaths = @($commandPaths + $outputPaths |
        Sort-Object -Unique |
        Where-Object { Test-RecentlyWritten -Path $_ -WindowSeconds $writeWindowSeconds })
    $shellPaths = @($commandPaths | Where-Object { $writtenPaths -notcontains $_ })

    return @(
        New-ToolFileUse -Kind 'write' -Paths $writtenPaths
        New-ToolFileUse -Kind 'shell' -Paths $shellPaths
    )
}

function ConvertTo-ResponseText {
    param([Parameter(Mandatory)][object]$Response)

    if ($Response -is [string]) {
        return $Response
    }

    $streams = @($Response.stdout, $Response.stderr | Where-Object { $_ })
    if ($streams.Count -gt 0) {
        return $streams -join "`n"
    }

    return $Response | ConvertTo-Json -Depth 5 -Compress
}

function Get-WriteWindowSeconds {
    param([Parameter(Mandatory)][object]$Config)

    if ($Config.writeWindowSeconds) {
        return [int]$Config.writeWindowSeconds
    }

    return $script:DefaultWriteWindowSeconds
}

function Test-RecentlyWritten {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][int]$WindowSeconds
    )

    $age = [datetime]::UtcNow - (Get-Item -LiteralPath $Path).LastWriteTimeUtc

    return $age.TotalSeconds -le $WindowSeconds
}
