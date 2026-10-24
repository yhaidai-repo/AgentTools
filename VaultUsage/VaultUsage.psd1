@{
    RootModule        = 'VaultUsage.psm1'
    ModuleVersion     = '0.1.0'
    GUID              = '395aabf7-708f-4686-8e0b-c56a5fcc7b29'
    Author            = 'gayda'
    Description       = 'Agent-agnostic usage tracking for documentation vaults: record note usage, report reads and last use.'
    PowerShellVersion = '7.0'
    FunctionsToExport = @(
        'Add-VaultUsage'
        'Find-VaultFileReference'
        'Get-VaultUsageConfig'
        'Get-VaultUsageEventId'
        'Get-VaultUsageReport'
    )
    CmdletsToExport   = @()
    VariablesToExport = @()
    AliasesToExport   = @()
}
