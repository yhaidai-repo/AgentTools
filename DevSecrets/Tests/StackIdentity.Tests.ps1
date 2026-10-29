$ErrorActionPreference = "Stop"
. "$PSScriptRoot/../LocalStack.Identity.ps1"
. "$PSScriptRoot/../LocalStack.Worktree.ps1"

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("guide-identity-test-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    & git -C $testRoot init -b main --quiet
    Set-Content -LiteralPath (Join-Path $testRoot "source.txt") -Value "version one"
    & git -C $testRoot add source.txt
    & git -C $testRoot -c user.name=GuideTests -c user.email=tests@example.invalid commit -m fixture --quiet --no-gpg-sign
    if ($LASTEXITCODE -ne 0) { throw "Fixture commit failed" }

    $selected = Get-StackBuildRoots @{ needed = $testRoot; unavailable = "Z:/missing-unrelated-repo" } @("needed")
    if ($selected.Count -ne 1 -or -not $selected.ContainsKey("needed")) { throw "Unrelated repos must not enter fingerprints" }
    $before = Get-StackBuildIdentity $selected "main"
    Set-Content -LiteralPath (Join-Path $testRoot "source.txt") -Value "version two"
    $changed = Get-StackBuildIdentity $selected "main"
    if ($before.needed -eq $changed.needed) { throw "Tracked changes were not fingerprinted" }
    Set-Content -LiteralPath (Join-Path $testRoot "untracked.txt") -Value "new source"
    $untracked = Get-StackBuildIdentity $selected "main"
    if ($changed.needed -eq $untracked.needed) { throw "Untracked changes were not fingerprinted" }
    $refused = $false
    try { Get-StackBuildIdentity $selected "missing-branch" | Out-Null } catch { $refused = $true }
    if (-not $refused) { throw "Actual branch mismatch must be refused" }

    # Keep missing-branch tests offline and independent of the machine's repo catalogue.
    function Get-WorktreeOfBranch { return $null }
    function Test-LocalBranch { return $false }
    function Test-RemoteBranch { return $false }
    $refused = $false
    try { Resolve-BranchRoot $testRoot "missing-branch" $true | Out-Null } catch { $refused = $true }
    if (-not $refused) { throw "Strict resolution fell back to main" }
    $fallback = Resolve-BranchRoot $testRoot "missing-branch" $false
    if ($fallback -ne $testRoot) { throw "Legacy fallback behavior changed" }
    Write-Output "PASS: selected repos, tracked/untracked source changes, exact branch, strict failure and legacy fallback"
} finally {
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
    if (-not $resolved.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $resolved) -notlike "guide-identity-test-*") { throw "Unsafe fixture cleanup target" }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
