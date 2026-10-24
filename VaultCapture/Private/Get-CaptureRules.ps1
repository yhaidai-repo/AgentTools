function Get-CaptureRules {
    $path = if ($env:VAULT_CAPTURE_RULES) { $env:VAULT_CAPTURE_RULES } else { Join-Path $script:ModuleRoot 'vault-rules.json' }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Vault rules not found: '$path'."
    }

    return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
}
