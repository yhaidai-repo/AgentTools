# Source fingerprints captured before build. No source text or secret values leave this function.
function Get-StackBuildRoots([hashtable] $Roots, [string[]] $Names) {
    $selected = @{}
    foreach ($name in $Names) { $selected[$name] = $Roots[$name] }
    return $selected
}

function Get-StackBuildIdentity([hashtable] $Roots, [string] $ExpectedBranch) {
    $identity = [ordered]@{}
    foreach ($name in @($Roots.Keys | Sort-Object)) {
        $root = $Roots[$name]
        if ($ExpectedBranch) {
            $actualBranch = (& git -C $root branch --show-current 2>$null | Out-String).Trim()
            if ($LASTEXITCODE -ne 0 -or $actualBranch -ne $ExpectedBranch) { throw "Repo $name is on a different branch; expected $ExpectedBranch." }
        }
        $commit = (& git -C $root rev-parse --verify HEAD 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) { throw "Cannot resolve source commit for $name" }
        $diff = (& git -C $root diff --no-ext-diff --binary HEAD 2>$null | Out-String)
        if ($LASTEXITCODE -ne 0) { throw "Cannot fingerprint source changes for $name" }
        $hash = [System.Security.Cryptography.IncrementalHash]::CreateHash([System.Security.Cryptography.HashAlgorithmName]::SHA256)
        try {
            $hash.AppendData([System.Text.Encoding]::UTF8.GetBytes($diff))
            foreach ($file in @(& git -C $root ls-files --others --exclude-standard | Sort-Object)) {
                $hash.AppendData([System.Text.Encoding]::UTF8.GetBytes($file))
                $hash.AppendData([System.IO.File]::ReadAllBytes((Join-Path $root $file)))
            }
            $identity[$name] = "$commit;source=$([Convert]::ToHexString($hash.GetHashAndReset()).ToLowerInvariant())"
        } finally { $hash.Dispose() }
    }
    return $identity
}
