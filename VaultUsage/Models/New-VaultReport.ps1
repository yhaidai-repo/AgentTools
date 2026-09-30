function New-VaultReport {
    param(
        [Parameter(Mandatory)][string]$Vault,
        [Parameter(Mandatory)][datetime]$GeneratedAt,
        [Nullable[datetime]]$Since,
        [object[]]$Notes = @()
    )

    return [pscustomobject][ordered]@{
        Vault       = $Vault
        GeneratedAt = $GeneratedAt
        Since       = $Since
        Notes       = $Notes
    }
}
