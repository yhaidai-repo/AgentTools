$script:ModuleRoot = $PSScriptRoot

foreach ($folder in 'Models', 'Private', 'Public') {
    foreach ($file in Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot $folder) -Filter '*.ps1') {
        . $file.FullName
    }
}
