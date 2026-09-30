function Get-VaultUsageReport {
    [CmdletBinding()]
    param(
        [string[]]$Vault,
        [Nullable[datetime]]$Since,
        [ValidateSet('object', 'markdown', 'json', 'csv')][string]$Format = 'markdown',
        [string]$OutFile,
        [object]$Config,
        [string]$ConfigPath
    )

    $usageConfig = if ($Config) { $Config } else { Get-VaultUsageConfig -ConfigPath $ConfigPath }
    $vaultRoots = if ($Vault) { $Vault | ForEach-Object { ConvertTo-NativePath -Path $_ } } else { $usageConfig.vaults }
    $reports = @($vaultRoots | ForEach-Object { Measure-VaultUsage -VaultRoot $_ -Config $usageConfig -Since $Since })
    $output = Format-VaultReport -Reports $reports -Format $Format

    if (-not $OutFile) {
        return $output
    }

    Set-Content -LiteralPath $OutFile -Value $output -Encoding utf8
}
