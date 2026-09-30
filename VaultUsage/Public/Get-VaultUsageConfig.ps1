function Get-VaultUsageConfig {
    [CmdletBinding()]
    param([string]$ConfigPath)

    $path = if ($ConfigPath) { $ConfigPath } else { Get-DefaultConfigPath }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Vault usage config not found: '$path'."
    }

    $config = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    $config.vaults = @($config.vaults | ForEach-Object { ConvertTo-NativePath -Path $_ })

    return $config
}

function Get-DefaultConfigPath {
    if ($env:VAULT_USAGE_CONFIG) {
        return $env:VAULT_USAGE_CONFIG
    }

    return Join-Path $script:ModuleRoot 'vault-usage.config.json'
}
