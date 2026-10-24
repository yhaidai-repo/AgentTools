function Get-VaultNote {
    param(
        [Parameter(Mandatory)][string]$VaultRoot,
        [Parameter(Mandatory)][object]$Config
    )

    return @(Get-ChildItem -LiteralPath $VaultRoot -Recurse -File |
        ForEach-Object { Resolve-VaultFile -Path $_.FullName -Config $Config } |
        Where-Object { $_ } |
        ForEach-Object { $_.RelativePath })
}
