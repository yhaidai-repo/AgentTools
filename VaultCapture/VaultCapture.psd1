@{
    RootModule        = 'VaultCapture.psm1'
    ModuleVersion     = '0.1.0'
    GUID              = '1f91d190-955b-46f0-9e73-4f0a67caed38'
    Author            = 'gayda'
    Description       = 'Agent-agnostic capture of session findings into vault drafts, with the vault rules enforced in code.'
    PowerShellVersion = '7.0'
    FunctionsToExport = @(
        'Get-CaptureInstruction'
        'Add-VaultRegisterRecord'
        'Get-VaultDraft'
        'Get-VaultRegister'
        'Get-VaultRules'
        'Save-VaultCapture'
        'Test-VaultDraft'
    )
    CmdletsToExport   = @()
    VariablesToExport = @()
    AliasesToExport   = @()
}
