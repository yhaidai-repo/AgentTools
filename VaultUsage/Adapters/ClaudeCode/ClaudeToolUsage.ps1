# Shared by the Claude Code hook and the history import: maps one Claude tool call to vault usage records.
Import-Module (Join-Path $PSScriptRoot '..' '..' 'VaultUsage.psd1')
. (Join-Path $PSScriptRoot 'Models' 'New-ToolFileUse.ps1')
. (Join-Path $PSScriptRoot 'Models' 'New-ClaudeToolCall.ps1')

$script:ClaudeAgentName = 'claude-code'

function Add-ClaudeToolUsage {
    param(
        [Parameter(Mandatory)][object]$ToolCall,
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][object]$Config
    )

    $fileUse = ConvertFrom-ClaudeToolCall -ToolCall $ToolCall -Config $Config
    if (-not $fileUse -or $fileUse.Paths.Count -eq 0) {
        return
    }

    Add-VaultUsage -Path $fileUse.Paths -Kind $fileUse.Kind -Agent $script:ClaudeAgentName -Subagent $ToolCall.Subagent `
        -Session $ToolCall.Session -Source $Source -EventId $ToolCall.Id -Timestamp $ToolCall.Timestamp `
        -Cwd $ToolCall.Cwd -Config $Config
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
            return New-ToolFileUse -Kind 'shell' -Paths (Find-VaultFileReference -Text ([string]$toolInput.command) -Cwd $ToolCall.Cwd -Config $Config)
        }
    }

    return $null
}
