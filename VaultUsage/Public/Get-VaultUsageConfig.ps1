function Get-VaultUsageConfig {
    [CmdletBinding()]
    param([string]$ConfigPath)

    $path = if ($ConfigPath) { $ConfigPath } else { Get-DefaultConfigPath }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Vault usage config not found: '$path'."
    }

    $config = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    # The list is optional (2026-10-06): any folder with ".obsidian" is a vault; listed ones are tracked without it.
    $config.vaults = @($config.vaults | ForEach-Object { ConvertTo-NativePath -Path $_ })

    return $config
}

function Get-DefaultConfigPath {
    if ($env:VAULT_USAGE_CONFIG) {
        return $env:VAULT_USAGE_CONFIG
    }

    return Join-Path $script:ModuleRoot 'vault-usage.config.json'
}
