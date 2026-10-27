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

    try { $lines = @((Read-DraftFile -Path $register.Path -Root $register.Root -ScopeRoot (Split-Path -Parent $register.Path)).Lines) }
    catch { return New-RegisterResult -Errors $_.Exception.Message }

    return New-RegisterResult -Records @(Get-RegisterRecordList -Lines $lines -Prefix $register.Prefix) -Path $register.Path
}
