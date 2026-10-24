function Get-VaultUsageEventId {
    [CmdletBinding()]
    param(
        [object]$Config,
        [string]$ConfigPath
    )

    $usageConfig = if ($Config) { $Config } else { Get-VaultUsageConfig -ConfigPath $ConfigPath }
    $eventIds = [Collections.Generic.HashSet[string]]::new()

    $usageConfig.vaults |
        ForEach-Object { Read-UsageLog -VaultRoot $_ -Config $usageConfig } |
        Where-Object { $_.eventId } |
        ForEach-Object { [void]$eventIds.Add($_.eventId) }

    return , $eventIds
}
