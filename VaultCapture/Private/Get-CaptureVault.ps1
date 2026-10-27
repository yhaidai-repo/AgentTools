# The vaults a call may capture into: the configured and requested roots, plus the vault the working directory lies in
# (a chat opened in a vault folder needs no configuration at all, 2026-10-06).
function Get-CaptureVault {
    param(
        [object]$Config,
        [string]$Cwd
    )

    $captureConfig = if ($Config) { $Config } else { Get-CaptureConfig }
    $roots = @($captureConfig.vaults) + @(Find-VaultRootOf -Path $Cwd)

    return @($roots | Where-Object { $_ } | Select-Object -Unique | ForEach-Object { ConvertTo-CaptureVault -Root $_ })
}

function ConvertTo-CaptureVault {
    param([Parameter(Mandatory)][string]$Root)

    $vaultName = Split-Path -Leaf $Root

    return New-CaptureVault -Name $vaultName -Root $Root -Projects (Get-VaultProject -VaultRoot $Root -VaultName $vaultName)
}

# By name among the known vaults, or any vault folder given as a path.
function Resolve-CaptureVault {
    param(
        [string]$Name,
        [object[]]$Vaults
    )

    $known = $Vaults | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
    if ($known) {
        return $known
    }

    if ($Name -and (Test-Path -LiteralPath $Name -PathType Container)) {
        return ConvertTo-CaptureVault -Root ([IO.Path]::GetFullPath($Name).TrimEnd('\', '/'))
    }

    return $null
}

# A project is a top-level folder whose "<key>-index.md" names its repository in "repo:".
# Folders without it (e.g. app-generated ones) are not projects agents capture into.
function Get-VaultProject {
    param(
        [Parameter(Mandatory)][string]$VaultRoot,
        [Parameter(Mandatory)][string]$VaultName
    )

    return @(Get-ChildItem -LiteralPath $VaultRoot -Directory |
        ForEach-Object {
            try {
                Assert-VaultFilePath -Root $VaultRoot -Path (Join-Path $_.FullName "$($_.Name)-index.md")
                ConvertTo-CaptureProject -Folder $_ -VaultName $VaultName
            }
            catch { $null }
        } |
        Where-Object { $_ })
}

function ConvertTo-CaptureProject {
    param(
        [Parameter(Mandatory)][IO.DirectoryInfo]$Folder,
        [Parameter(Mandatory)][string]$VaultName
    )

    $indexPath = Join-Path $Folder.FullName "$($Folder.Name)-index.md"
    if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
        return $null
    }

    $repoPath = ConvertFrom-RepoValue -Value (Get-FrontmatterValue -Lines @(Get-Content -LiteralPath $indexPath) -Key 'repo')
    if (-not $repoPath) {
        return $null
    }

    return New-CaptureProject -Key $Folder.Name -Vault $VaultName -RepoPath $repoPath
}

# "repo:" holds a path, optionally followed by "(folder Sub/)" when the project lives in a subfolder of the repository.
function ConvertFrom-RepoValue {
    param([string]$Value)

    if ($Value -notmatch '^(?<path>[^(]+?)\s*(?:\(folder\s+(?<folder>[^)]+?)\)\s*)?$') {
        return $null
    }

    $folder = if ($Matches.folder) { $Matches.folder.Trim('/', '\') } else { '' }

    # Plain string combine: Join-Path needs the drive to exist, and a host path like "D:/Projects/POS" has none in a Linux container.
    return [IO.Path]::GetFullPath([IO.Path]::Combine($Matches.path.Trim(), $folder)).TrimEnd('\', '/')
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
