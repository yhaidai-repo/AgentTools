function Add-VaultUsage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string[]]$Path,
        [Parameter(Mandatory)][string]$Kind,
        [Parameter(Mandatory)][string]$Agent,
        [string]$Subagent,
        [string]$Session,
        [string]$Source = 'manual',
        [string]$EventId,
        [datetime]$Timestamp = [datetime]::UtcNow,
        [string]$Cwd,
        [object]$Config,
        [string]$ConfigPath
    )

    $usageConfig = if ($Config) { $Config } else { Get-VaultUsageConfig -ConfigPath $ConfigPath }
    $vaultFiles = @($Path |
        Where-Object { $_ } |
        ForEach-Object { Resolve-VaultFile -Path $_ -BasePath $Cwd -Config $usageConfig } |
        Where-Object { $_ } |
        Sort-Object -Property FullPath -Unique)

    foreach ($vaultFile in $vaultFiles) {
        $record = New-UsageRecord -Timestamp $Timestamp -File $vaultFile.RelativePath -Kind $Kind -Agent $Agent `
            -Subagent $Subagent -Session $Session -Source $Source -EventId $EventId
        $logPath = Get-UsageLogPath -VaultRoot $vaultFile.VaultRoot -Config $usageConfig

        Add-UsageLine -LogPath $logPath -Line ($record | ConvertTo-Json -Compress)
        $record
    }
}
