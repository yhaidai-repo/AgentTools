<#
.SYNOPSIS
    Applies the local-only code patches from ./patches to a checkout and hides them from git.

.DESCRIPTION
    Each patch is applied with 'git apply' (skipped when it is already applied), then its files are marked
    'git update-index --skip-worktree', so 'git status' and 'git add .' ignore them.
    All patches are checked before any is applied.

    Before pulling or switching to a branch that changes one of these files, run with -Release, then run
    again without it afterwards.

.EXAMPLE
    Use-LocalPatches.ps1
    Applies the patches to the checkout of the current directory.

.EXAMPLE
    ./Use-LocalPatches.ps1 -Repo D:/Projects/PVS.Internal

.EXAMPLE
    ./Use-LocalPatches.ps1 -Repo D:/Projects/PVS.Internal-wt/29352 -Release
#>
[CmdletBinding()]
param(
    # Defaults to the git checkout of the current directory.
    [string] $Repo,

    [switch] $Release
)

$ErrorActionPreference = "Stop"

$PatchDir = Join-Path $PSScriptRoot "patches"

function Resolve-Repo([string] $Path) {
    if ($Path) {
        return $Path
    }

    $root = git rev-parse --show-toplevel 2>$null

    if ($LASTEXITCODE -ne 0 -or -not $root) {
        throw "Not inside a git checkout: pass -Repo <path>."
    }

    return $root
}

$Repo = Resolve-Repo $Repo

function Get-PatchedFiles([string] $PatchPath) {
    return Select-String -LiteralPath $PatchPath -Pattern '^\+\+\+ b/(.+)$' | ForEach-Object { $_.Matches[0].Groups[1].Value }
}

function Test-GitApply([string] $PatchPath, [string[]] $ExtraArgs) {
    git -C $Repo apply --check @ExtraArgs $PatchPath 2>$null

    return $LASTEXITCODE -eq 0
}

function Get-PatchState([string] $PatchPath) {
    if (Test-GitApply $PatchPath @("--reverse")) {
        return "applied"
    }

    if (Test-GitApply $PatchPath @()) {
        return "pending"
    }

    return "conflict"
}

function Set-SkipWorktree([string[]] $Files, [bool] $Enabled) {
    $flag = if ($Enabled) { "--skip-worktree" } else { "--no-skip-worktree" }

    git -C $Repo update-index $flag -- @Files
}

$patches = @(Get-ChildItem -LiteralPath $PatchDir -Filter *.patch | Sort-Object Name)

if ($Release) {
    $patches | ForEach-Object { Set-SkipWorktree @(Get-PatchedFiles $_.FullName) $false }
    Write-Host "Released $($patches.Count) patch(es): git sees their files again."

    return
}

function Test-PatchForRepo([string] $PatchPath) {
    # Patches of several repos share the folder; a patch belongs to the repo that has all its files.
    $missing = @(Get-PatchedFiles $PatchPath | Where-Object { -not (Test-Path -LiteralPath (Join-Path $Repo $_)) })

    return $missing.Count -eq 0
}

$patches | Where-Object { -not (Test-PatchForRepo $_.FullName) } | ForEach-Object { Write-Host "$($_.Name): not for this repo, skipped" }
$patches = @($patches | Where-Object { Test-PatchForRepo $_.FullName })

$states = $patches | ForEach-Object { [pscustomobject]@{ Patch = $_; State = Get-PatchState $_.FullName } }
$conflicts = @($states | Where-Object State -eq "conflict")

if ($conflicts.Count -gt 0) {
    $conflicts | ForEach-Object { Write-Error "$($_.Patch.Name): does not apply to $Repo (code changed?)" -ErrorAction Continue }

    throw "Nothing was applied: update or remove the $($conflicts.Count) patch(es) above."
}

$states | Where-Object State -eq "pending" | ForEach-Object { git -C $Repo apply $_.Patch.FullName }
$patches | ForEach-Object { Set-SkipWorktree @(Get-PatchedFiles $_.FullName) $true }

$states | ForEach-Object { Write-Host "$($_.Patch.Name): $(if ($_.State -eq 'pending') { 'applied' } else { 'already applied' }), hidden from git" }
