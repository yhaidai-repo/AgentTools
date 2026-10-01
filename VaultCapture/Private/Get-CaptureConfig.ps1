function Get-CaptureConfig {
    $path = if ($env:VAULT_CAPTURE_CONFIG) { $env:VAULT_CAPTURE_CONFIG } else { Join-Path $script:ModuleRoot 'vault-capture.config.json' }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Vault capture config not found: '$path'."
    }

    $config = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    $config.vaults = @($config.vaults | ForEach-Object { [IO.Path]::GetFullPath($_) })

    return $config
}
