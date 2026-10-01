function Get-VaultUsageReport {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Vault,
        [Nullable[datetime]]$Since,
        [ValidateSet('object', 'markdown', 'json', 'csv')][string]$Format = 'markdown',
        [string]$OutFile,
        [object]$Config,
        [string]$ConfigPath
    )

    $usageConfig = if ($Config) { $Config } else { Get-VaultUsageConfig -ConfigPath $ConfigPath }
    $report = Measure-VaultUsage -VaultRoot (ConvertTo-NativePath -Path $Vault) -Config $usageConfig -Since $Since
    $output = Format-VaultReport -Report $report -Format $Format

    if (-not $OutFile) {
        return $output
    }

    Set-Content -LiteralPath $OutFile -Value $output -Encoding utf8
}
