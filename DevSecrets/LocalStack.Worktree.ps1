# Checkouts a local stack builds from: the main checkouts, or one worktree per repo for a branch (dot-sourced).

function Get-WorktreeOfBranch([string] $RepoRoot, [string] $Branch) {
    $lines = git -C $RepoRoot worktree list --porcelain
    $paths = @($lines | Where-Object { $_ -like "worktree *" } | ForEach-Object { $_.Substring(9) })
    $branches = @($lines | Where-Object { $_ -like "branch *" -or $_ -eq "detached" })
    $index = [array]::IndexOf($branches, "branch refs/heads/$Branch")

    return $(if ($index -ge 0) { $paths[$index] } else { $null })
}

function Test-LocalBranch([string] $RepoRoot, [string] $Branch) {
    git -C $RepoRoot show-ref --verify --quiet "refs/heads/$Branch"

    return $LASTEXITCODE -eq 0
}

function Test-RemoteBranch([string] $RepoRoot, [string] $Branch) {
    git -C $RepoRoot ls-remote --exit-code --heads origin $Branch 2>&1 | Out-Null

    return $LASTEXITCODE -eq 0
}

function Get-NewWorktreePath([string] $RepoRoot, [string] $Branch) {
    # Same layout as the create-branch skill: <parent>/<repo>-wt/<type>/<name>.
    return Join-Path (Split-Path -Parent $RepoRoot) "$(Split-Path -Leaf $RepoRoot)-wt/$Branch"
}

function Add-BranchWorktree([string] $RepoRoot, [string] $Branch) {
    $path = Get-NewWorktreePath $RepoRoot $Branch

    if (Test-LocalBranch $RepoRoot $Branch) {
        git -C $RepoRoot worktree add $path $Branch
    }
    else {
        git -C $RepoRoot fetch origin $Branch
        git -C $RepoRoot worktree add --track -b $Branch $path "origin/$Branch"
    }

    if ($LASTEXITCODE -ne 0) {
        throw "git worktree add failed for $Branch in $RepoRoot"
    }

    return $path
}

function Resolve-BranchRoot([string] $RepoRoot, [string] $Branch) {
    $existing = Get-WorktreeOfBranch $RepoRoot $Branch

    if ($existing) {
        return $existing
    }

    if ((Test-LocalBranch $RepoRoot $Branch) -or (Test-RemoteBranch $RepoRoot $Branch)) {
        return Add-BranchWorktree $RepoRoot $Branch
    }

    Write-Warning "$(Split-Path -Leaf $RepoRoot): branch '$Branch' not found, using the main checkout"

    return $RepoRoot
}

function Get-StackRoots([hashtable] $Repos, [string[]] $RepoNames, [string] $Branch, [string[]] $Overrides) {
    $roots = @{} + $Repos

    foreach ($override in ($Overrides | ForEach-Object { $_ -split ',' } | Where-Object { $_ })) {
        $name, $path = $override -split '=', 2
        $roots[$name.Trim()] = $path.Trim()
    }

    if (-not $Branch) {
        return $roots
    }

    foreach ($name in ($RepoNames | Where-Object { -not ($Overrides -match "^$_=") })) {
        $roots[$name] = Resolve-BranchRoot $Repos[$name] $Branch
    }

    return $roots
}

function Invoke-LocalPatches([string[]] $Roots) {
    foreach ($root in ($Roots | Select-Object -Unique)) {
        Write-Host "Patches in ${root}:"
        & "$PSScriptRoot/Use-LocalPatches.ps1" -Repo $root
    }
}

function Initialize-NpmPackages([string] $PackageDir) {
    # The portal serves its node_modules (git-ignored), so a fresh branch worktree needs them installed.
    if (Test-Path -LiteralPath (Join-Path $PackageDir "node_modules")) {
        return
    }

    Write-Host "node_modules missing in $PackageDir, installing"
    Push-Location $PackageDir

    try {
        npm ci --no-audit --no-fund --loglevel error

        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed in $PackageDir"
        }
    }
    finally {
        Pop-Location
    }
}

function Initialize-DenoCache([string] $ScriptsDir) {
    # The runner starts Deno with --cached-only, so the vendor folder (git-ignored) must be complete.
    if (Test-Path -LiteralPath (Join-Path $ScriptsDir "vendor/jsr.io/@std/log")) {
        return
    }

    Write-Host "Deno cache missing in $ScriptsDir, installing"
    Push-Location $ScriptsDir

    try {
        deno install --frozen --entrypoint main.ts

        if ($LASTEXITCODE -ne 0) {
            throw "deno install failed in $ScriptsDir"
        }
    }
    finally {
        Pop-Location
    }
}
