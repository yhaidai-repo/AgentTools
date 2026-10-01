# The project an agent works on = the project whose repository contains the agent's working directory.
function Resolve-CaptureProject {
    param(
        [string]$Cwd,
        [Parameter(Mandatory)][object[]]$Vaults
    )

    if ([string]::IsNullOrWhiteSpace($Cwd)) {
        return $null
    }

    $location = Resolve-RepoLocation -Path $Cwd

    return $Vaults.Projects |
        Where-Object { Test-PathWithin -Path $location -Root $_.RepoPath } |
        Sort-Object -Property { $_.RepoPath.Length } -Descending |
        Select-Object -First 1
}

# A git worktree (e.g. PVS.Internal-wt/29349) maps back to the same place in its main repository.
function Resolve-RepoLocation {
    param([Parameter(Mandatory)][string]$Path)

    $fullPath = [IO.Path]::GetFullPath($Path)
    $worktreeRoot = Invoke-Git -Path $fullPath -Arguments @('rev-parse', '--show-toplevel')
    $commonDir = Invoke-Git -Path $fullPath -Arguments @('rev-parse', '--path-format=absolute', '--git-common-dir')
    if (-not $worktreeRoot -or -not $commonDir) {
        return $fullPath
    }

    $mainRoot = Split-Path -Parent ([IO.Path]::GetFullPath($commonDir))
    $relativePath = [IO.Path]::GetRelativePath([IO.Path]::GetFullPath($worktreeRoot), $fullPath)

    return [IO.Path]::GetFullPath((Join-Path $mainRoot $relativePath))
}

function Invoke-Git {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string[]]$Arguments
    )

    try {
        $output = & git -C $Path @Arguments 2>$null
    }
    catch {
        return $null
    }

    if ($LASTEXITCODE -ne 0) {
        return $null
    }

    return [string]($output | Select-Object -First 1)
}

function Test-PathWithin {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Root
    )

    $comparison = if ($IsLinux) { [StringComparison]::Ordinal } else { [StringComparison]::OrdinalIgnoreCase }
    $trimmedRoot = $Root.TrimEnd('\', '/')
    $isRoot = $Path.TrimEnd('\', '/').Equals($trimmedRoot, $comparison)

    return $isRoot -or $Path.StartsWith($trimmedRoot + [IO.Path]::DirectorySeparatorChar, $comparison)
}
