# Whether each named note is still a draft, i.e. not yet verified, moved to its target and deleted from the draft folder.
function Test-VaultDraft {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Vault,
        [Parameter(Mandatory)][string[]]$Name,
        [object]$Config
    )

    $rules = Get-CaptureRules
    $vaultInfo = Resolve-CaptureVault -Name $Vault -Vaults (Get-CaptureVault -Config $Config)
    $invalid = @($Name | Where-Object { $_ -notmatch $rules.draft.namePattern })
    $errors = @(Get-DraftQueryError -Vault $Vault -VaultInfo $vaultInfo -InvalidNames $invalid)
    if ($errors) {
        return New-DraftQueryResult -Errors $errors
    }

    $state = [ordered]@{}
    try {
        $Name | ForEach-Object {
            $path = Join-Path $vaultInfo.Root $rules.draft.folder "$_.md"
            Assert-VaultFilePath -Root $vaultInfo.Root -Path $path -ScopeRoot (Join-Path $vaultInfo.Root $rules.draft.folder)
            $state[$_] = Test-Path -LiteralPath $path -PathType Leaf
        }
    }
    catch { return New-DraftQueryResult -Errors $_.Exception.Message }

    return New-DraftQueryResult -Drafts ([pscustomobject]$state)
}

function Get-DraftQueryError {
    param(
        [Parameter(Mandatory)][string]$Vault,
        [object]$VaultInfo,
        [string[]]$InvalidNames = @()
    )

    if (-not $VaultInfo) {
        return "vault '$Vault' is unknown."
    }

    return @($InvalidNames | ForEach-Object { "name '$_' is not a note name (kebab-case)." })
}
