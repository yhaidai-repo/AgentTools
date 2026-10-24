function New-VaultFile {
    param(
        [Parameter(Mandatory)][string]$VaultRoot,
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][string]$FullPath
    )

    return [pscustomobject]@{
        VaultRoot    = $VaultRoot
        RelativePath = $RelativePath
        FullPath     = $FullPath
    }
}
