# The config file is optional since 2026-10-06: a vault is any folder with ".obsidian", found from the working directory,
# or named by VAULT_CAPTURE_VAULTS (paths separated by ";") / the CLI's -VaultRoot. The file's list still adds vaults,
# e.g. so a chat in a repository finds the vault whose project documents that repository.
function Get-CaptureConfig {
    $path = if ($env:VAULT_CAPTURE_CONFIG) { $env:VAULT_CAPTURE_CONFIG } else { Join-Path $script:ModuleRoot 'vault-capture.config.json' }
    $config = if (Test-Path -LiteralPath $path -PathType Leaf) { Get-Content -LiteralPath $path -Raw | ConvertFrom-Json } else { [pscustomobject]@{ vaults = @() } }
    $listed = @($config.vaults | ForEach-Object { [IO.Path]::GetFullPath($_) })
    $requested = @(Get-RequestedVaultRoot)

    $config.vaults = @(($listed + $requested) | Where-Object { $_ } | Select-Object -Unique)

    return $config
}

function Get-RequestedVaultRoot {
    if (-not $env:VAULT_CAPTURE_VAULTS) {
        return @()
    }

    return @($env:VAULT_CAPTURE_VAULTS.Split(';') | Where-Object { $_.Trim() } | ForEach-Object { [IO.Path]::GetFullPath($_.Trim()) })
}

# The Obsidian vault a path lies in: the nearest folder up the tree holding ".obsidian"; null outside any vault.
function Find-VaultRootOf {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $null
    }

    $folder = [IO.Path]::GetFullPath($Path)
    while ($folder) {
        if (Test-Path -LiteralPath (Join-Path $folder '.obsidian') -PathType Container) {
            return $folder.TrimEnd('\', '/')
        }

        $folder = Split-Path -Parent $folder
    }

    return $null
}
