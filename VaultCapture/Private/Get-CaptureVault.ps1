function Get-CaptureVault {
    param([object]$Config)

    $captureConfig = if ($Config) { $Config } else { Get-CaptureConfig }

    return @($captureConfig.vaults | ForEach-Object {
        New-CaptureVault -Name (Split-Path -Leaf $_) -Root $_ -Projects (Get-VaultProject -VaultRoot $_)
    })
}

function Resolve-CaptureVault {
    param(
        [string]$Name,
        [object[]]$Vaults
    )

    return $Vaults | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
}

# A project is a top-level folder holding its "<key>-index.md" entry note.
function Get-VaultProject {
    param([Parameter(Mandatory)][string]$VaultRoot)

    return @(Get-ChildItem -LiteralPath $VaultRoot -Directory |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "$($_.Name)-index.md") -PathType Leaf } |
        ForEach-Object { $_.Name })
}

function Find-NoteOutsideDraft {
    param(
        [Parameter(Mandatory)][object]$Vault,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][object]$Rules
    )

    $draftRoot = Join-Path $Vault.Root $Rules.draft.folder

    return Get-ChildItem -LiteralPath $Vault.Root -Recurse -File -Filter "$Name.md" |
        Where-Object { -not $_.FullName.StartsWith($draftRoot, [StringComparison]::OrdinalIgnoreCase) } |
        Select-Object -First 1
}
