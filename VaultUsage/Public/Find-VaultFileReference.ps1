function Find-VaultFileReference {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][AllowEmptyString()][string]$Text,
        [string]$Cwd,
        [object]$Config,
        [string]$ConfigPath
    )

    $usageConfig = if ($Config) { $Config } else { Get-VaultUsageConfig -ConfigPath $ConfigPath }
    if (Test-SelfLoggingCommand -Text $Text -Config $usageConfig) {
        return @()
    }

    $basePaths = @(Get-ChangeDirectoryTarget -Text $Text -Cwd $Cwd) + @(Get-AbsoluteBasePath -BasePath $Cwd)

    return @(Get-PathToken -Text $Text -Extensions $usageConfig.extensions |
        ForEach-Object { Resolve-ReferencedNote -Token $_ -BasePaths $basePaths -Config $usageConfig } |
        Where-Object { $_ } |
        Sort-Object -Unique)
}

# Vault tools log their own usage; note paths in their input are mentions, not reads.
function Test-SelfLoggingCommand {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][string]$Text,
        [Parameter(Mandatory)][object]$Config
    )

    $matchingCommands = @($Config.selfLoggingCommands | Where-Object { $_ -and $Text.Contains($_, [StringComparison]::OrdinalIgnoreCase) })

    return $matchingCommands.Count -gt 0
}

function Get-PathToken {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][string]$Text,
        [Parameter(Mandatory)][string[]]$Extensions
    )

    $extensionPattern = ($Extensions | ForEach-Object { [regex]::Escape($_.TrimStart('.')) }) -join '|'
    $pattern = "[^\s""'``;|&<>(){}=,]+\.(?:$extensionPattern)(?![\w])"

    return [regex]::Matches($Text, $pattern) | ForEach-Object { $_.Value } | Sort-Object -Unique
}

# Agents usually run "cd <folder>; cat <note>", so relative note paths are resolved against the cd targets first.
function Get-ChangeDirectoryTarget {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][string]$Text,
        [string]$Cwd
    )

    $pattern = '(?:^|[;&|\s(])(?:cd|pushd|Set-Location|sl|git\s+-C)\s+(?:/d\s+|-(?:Literal)?Path\s+)?(?<dir>"[^"]+"|''[^'']+''|[^\s;&|)]+)'

    return [regex]::Matches($Text, $pattern, 'IgnoreCase') |
        ForEach-Object { ConvertTo-NativePath -Path $_.Groups['dir'].Value.Trim('"', "'") -BasePath $Cwd }
}

function Resolve-ReferencedNote {
    param(
        [Parameter(Mandatory)][string]$Token,
        [Parameter(Mandatory)][string[]]$BasePaths,
        [Parameter(Mandatory)][object]$Config
    )

    return $BasePaths |
        ForEach-Object { Resolve-VaultFile -Path $Token -BasePath $_ -Config $Config } |
        Where-Object { $_ -and (Test-Path -LiteralPath $_.FullPath -PathType Leaf) } |
        Select-Object -First 1 |
        ForEach-Object { $_.FullPath }
}
