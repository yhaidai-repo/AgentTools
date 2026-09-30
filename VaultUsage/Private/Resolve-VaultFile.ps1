function Resolve-VaultFile {
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$BasePath,
        [Parameter(Mandatory)][object]$Config
    )

    $fullPath = ConvertTo-NativePath -Path $Path -BasePath $BasePath
    $vaultRoot = Find-VaultRoot -FullPath $fullPath -Config $Config
    if (-not $vaultRoot) {
        return $null
    }

    $relativePath = [IO.Path]::GetRelativePath($vaultRoot, $fullPath).Replace('\', '/')
    if (-not (Test-TrackedNote -RelativePath $relativePath -Config $Config)) {
        return $null
    }

    return New-VaultFile -VaultRoot $vaultRoot -RelativePath $relativePath -FullPath $fullPath
}

function Find-VaultRoot {
    param(
        [Parameter(Mandatory)][string]$FullPath,
        [Parameter(Mandatory)][object]$Config
    )

    return $Config.vaults |
        Where-Object { Test-PathUnderRoot -Path $FullPath -Root $_ } |
        Select-Object -First 1
}

function Test-PathUnderRoot {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Root
    )

    $rootWithSeparator = $Root.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    $comparison = if ($IsLinux) { [StringComparison]::Ordinal } else { [StringComparison]::OrdinalIgnoreCase }

    return $Path.StartsWith($rootWithSeparator, $comparison)
}

function Test-TrackedNote {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][object]$Config
    )

    $isTrackedExtension = $Config.extensions -contains [IO.Path]::GetExtension($RelativePath)
    $excludedSegments = @($RelativePath.Split('/') | Where-Object { $Config.excludeFolders -contains $_ })

    return $isTrackedExtension -and $excludedSegments.Count -eq 0
}
