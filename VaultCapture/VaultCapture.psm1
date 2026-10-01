$script:ModuleRoot = $PSScriptRoot

# Vault roots and usage logging come from VaultUsage, so both modules share one vault list.
Import-Module (Join-Path $PSScriptRoot '..' 'VaultUsage' 'VaultUsage.psd1')

foreach ($folder in 'Models', 'Private', 'Public') {
    foreach ($file in Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot $folder) -Filter '*.ps1') {
        . $file.FullName
    }
}
