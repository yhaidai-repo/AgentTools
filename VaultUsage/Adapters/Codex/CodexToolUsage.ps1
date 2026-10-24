Import-Module (Join-Path $PSScriptRoot '..' '..' 'VaultUsage.psd1')
. (Join-Path $PSScriptRoot '..' 'Shared' 'ShellToolUsage.ps1')
. (Join-Path $PSScriptRoot 'Models' 'New-CodexToolCall.ps1')

function Add-CodexToolUsage {
    param(
        [Parameter(Mandatory)][object]$ToolCall,
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][object]$Config
    )

    $fileUses = @(ConvertFrom-CodexToolCall -ToolCall $ToolCall -Config $Config | Where-Object { $_.Paths.Count -gt 0 })

    foreach ($fileUse in $fileUses) {
        $parameters = @{
            Path = $fileUse.Paths
            Kind = $fileUse.Kind
            Agent = 'codex'
            Session = $ToolCall.Session
            Source = $Source
            EventId = $ToolCall.Id
            Timestamp = $ToolCall.Timestamp
            Cwd = $ToolCall.Cwd
            Config = $Config
        }

        Add-VaultUsage @parameters
    }
}

function ConvertFrom-CodexToolCall {
    param(
        [Parameter(Mandatory)][object]$ToolCall,
        [Parameter(Mandatory)][object]$Config
    )

    switch -Regex ($ToolCall.Name) {
        '^mcp__powerloom__' {
            return $null
        }
        '^(Bash|PowerShell|exec_command)$' {
            return ConvertFrom-ShellToolCall -ToolCall (ConvertTo-CodexShellCall -ToolCall $ToolCall) -Config $Config
        }
        '^apply_patch$' {
            return ConvertFrom-CodexPatch -ToolCall $ToolCall
        }
    }

    return $null
}

function ConvertTo-CodexShellCall {
    param([Parameter(Mandatory)][object]$ToolCall)

    $command = if ($ToolCall.ToolInput.command) { $ToolCall.ToolInput.command } else { $ToolCall.ToolInput.cmd }
    $cwd = if ($ToolCall.ToolInput.workdir) { $ToolCall.ToolInput.workdir } else { $ToolCall.Cwd }
    $parameters = @{
        Id = $ToolCall.Id
        Name = $ToolCall.Name
        ToolInput = [pscustomobject]@{ command = [string]$command }
        ToolResponse = $ToolCall.ToolResponse
        Cwd = $cwd
        Session = $ToolCall.Session
        Timestamp = $ToolCall.Timestamp
    }

    return New-CodexToolCall @parameters
}

function ConvertFrom-CodexPatch {
    param([Parameter(Mandatory)][object]$ToolCall)

    $patch = Get-CodexPatchText -ToolInput $ToolCall.ToolInput
    $pattern = '(?m)^\*\*\* (?:Add File|Update File|Delete File|Move to): (?<path>.+?)\r?$'
    $paths = @([regex]::Matches($patch, $pattern) |
        ForEach-Object { Resolve-CodexPatchPath -Path $_.Groups['path'].Value -Cwd $ToolCall.Cwd } |
        Sort-Object -Unique)

    return New-ToolFileUse -Kind 'write' -Paths $paths
}

function Get-CodexPatchText {
    param([object]$ToolInput)

    if ($ToolInput -is [string]) {
        return $ToolInput
    }

    return [string]$ToolInput.command
}

function Resolve-CodexPatchPath {
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$Cwd
    )

    if ([IO.Path]::IsPathRooted($Path)) {
        return [IO.Path]::GetFullPath($Path)
    }

    if (-not $Cwd) {
        return $null
    }

    return [IO.Path]::GetFullPath($Path, $Cwd)
}
