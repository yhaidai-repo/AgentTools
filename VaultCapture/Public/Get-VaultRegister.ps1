# The records of a project's open-questions or known-issues register, so writers can check what is already recorded.
function Get-VaultRegister {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Vault,
        [Parameter(Mandatory)][string]$Project,
        [Parameter(Mandatory)][string]$Kind,
        [object]$Config
    )

    $vaultInfo = Resolve-CaptureVault -Name $Vault -Vaults (Get-CaptureVault -Config $Config)
    if (-not $vaultInfo) {
        return New-RegisterResult -Errors "vault '$Vault' is unknown."
    }

    $register = Resolve-RegisterFile -Vault $vaultInfo -Project $Project -Kind $Kind
    if ($register.Error) {
        return New-RegisterResult -Errors $register.Error
    }

    $lines = @(Get-Content -LiteralPath $register.Path)

    return New-RegisterResult -Records @(Get-RegisterRecordList -Lines $lines -Prefix $register.Prefix) -Path $register.Path
}
