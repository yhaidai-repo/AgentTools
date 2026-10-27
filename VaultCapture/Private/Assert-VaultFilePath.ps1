# Existing links are never writable draft/register paths, even when they point elsewhere inside the vault.
function Assert-VaultFilePath {
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$Path,
        [string]$ScopeRoot
    )

    $base = [IO.Path]::GetFullPath($Root)
    $target = [IO.Path]::GetFullPath($Path)
    $scope = if ($ScopeRoot) { [IO.Path]::GetFullPath($ScopeRoot) } else { $base }
    foreach ($boundary in @($base, $scope)) {
        $relative = [IO.Path]::GetRelativePath($boundary, $target)
        if ([IO.Path]::IsPathRooted($relative) -or $relative -eq '..' -or $relative.StartsWith('..' + [IO.Path]::DirectorySeparatorChar)) {
            throw "path '$Path' is outside its allowed vault scope."
        }
    }

    $relative = [IO.Path]::GetRelativePath($base, $target)
    $parts = @($relative -split '[\\/]')
    $current = $base
    foreach ($part in @('') + $parts) {
        if ($part -and $part -ne '.') { $current = Join-Path $current $part }
        try { $attributes = [IO.File]::GetAttributes($current) }
        catch {
            $cause = $_.Exception.GetBaseException()
            if ($cause -is [IO.FileNotFoundException] -or $cause -is [IO.DirectoryNotFoundException]) { break }
            throw
        }
        if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "path '$Path' contains a filesystem alias; draft/register aliases are not allowed."
        }
    }
}
