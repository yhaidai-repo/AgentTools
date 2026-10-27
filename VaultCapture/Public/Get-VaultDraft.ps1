# The drafts waiting to be verified and merged, in the order a writer should take them:
# drafts whose source starts with -PreferSource first (e.g. a pipeline's own findings), then oldest first.
function Get-VaultDraft {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Vault,
        [string]$PreferSource,
        [object]$Config
    )

    $rules = Get-CaptureRules
    $vaultInfo = Resolve-CaptureVault -Name $Vault -Vaults (Get-CaptureVault -Config $Config)
    if (-not $vaultInfo) {
        return New-DraftQueryResult -Errors "vault '$Vault' is unknown."
    }

    try {
        $drafts = @(Get-DraftFile -Vault $vaultInfo -Rules $rules | ForEach-Object {
            Assert-VaultFilePath -Root $vaultInfo.Root -Path $_.FullName -ScopeRoot (Join-Path $vaultInfo.Root $rules.draft.folder)
            ConvertTo-DraftInfo -File $_ -PreferSource $PreferSource
        })
    }
    catch { return New-DraftQueryResult -Errors $_.Exception.Message }
    $ordered = @($drafts | Sort-Object -Property @{ Expression = { -not $_.preferred } }, captured, name)

    return New-DraftQueryResult -Drafts $ordered
}

function Get-DraftFile {
    param(
        [Parameter(Mandatory)][object]$Vault,
        [Parameter(Mandatory)][object]$Rules
    )

    $draftRoot = Join-Path $Vault.Root $Rules.draft.folder
    Assert-VaultFilePath -Root $Vault.Root -Path $draftRoot -ScopeRoot $draftRoot
    if (-not (Test-Path -LiteralPath $draftRoot -PathType Container)) {
        return @()
    }

    return @(Get-ChildItem -LiteralPath $draftRoot -File -Filter '*.md')
}

function ConvertTo-DraftInfo {
    param(
        [Parameter(Mandatory)][IO.FileInfo]$File,
        [string]$PreferSource
    )

    $lines = @(Get-Content -LiteralPath $File.FullName)
    $source = Get-FrontmatterValue -Lines $lines -Key 'source'
    $isPreferred = [bool]$PreferSource -and $source.StartsWith($PreferSource, [StringComparison]::OrdinalIgnoreCase)

    return New-DraftInfo `
        -Name $File.BaseName `
        -Title (Get-FrontmatterValue -Lines $lines -Key 'title') `
        -Project (Get-FrontmatterValue -Lines $lines -Key 'project') `
        -Captured (Get-FrontmatterValue -Lines $lines -Key 'captured') `
        -Source $source `
        -Target (Get-FrontmatterValue -Lines $lines -Key 'target') `
        -Path $File.FullName `
        -Preferred $isPreferred
}
