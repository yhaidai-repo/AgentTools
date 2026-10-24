# Register notes are read, changed and written back by more than one process: the backend's chat tools and findings and
# the runner's agents add through this module, and the backend closes records itself. Each writer holds the register's
# lock file meanwhile (the same `.<note>.lock` the backend's NoteLock takes): created only if it isn't there, removed
# when done. A lock older than a minute is left over from a killed writer and is taken over.
$script:RegisterLockStaleSeconds = 60

function Use-RegisterLock {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][scriptblock]$Action,
        [int]$TimeoutSeconds = 15
    )

    $lock = Get-RegisterLockPath -Path $Path
    if (-not (Enter-RegisterLock -Lock $lock -TimeoutSeconds $TimeoutSeconds)) {
        return New-RegisterResult -Errors @('the register is being written by another process: try again in a moment.')
    }

    try {
        return & $Action
    }
    finally {
        Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue
    }
}

function Get-RegisterLockPath {
    param([Parameter(Mandatory)][string]$Path)

    return Join-Path (Split-Path -Parent $Path) ".$(Split-Path -Leaf $Path).lock"
}

function Enter-RegisterLock {
    param(
        [Parameter(Mandatory)][string]$Lock,
        [int]$TimeoutSeconds
    )

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while (-not (New-RegisterLockFile -Lock $Lock)) {
        if (Remove-StaleRegisterLock -Lock $Lock) {
            continue
        }

        if ([DateTime]::UtcNow -gt $deadline) {
            return $false
        }

        Start-Sleep -Milliseconds 100
    }

    return $true
}

function New-RegisterLockFile {
    param([Parameter(Mandatory)][string]$Lock)

    try {
        [IO.File]::Open($Lock, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None).Dispose()
        return $true
    }
    catch [IO.IOException] {
        return $false
    }
}

function Remove-StaleRegisterLock {
    param([Parameter(Mandatory)][string]$Lock)

    $item = Get-Item -LiteralPath $Lock -Force -ErrorAction SilentlyContinue
    $stale = $item -and $item.LastWriteTimeUtc -lt [DateTime]::UtcNow.AddSeconds(-$script:RegisterLockStaleSeconds)
    if ($stale) {
        Remove-Item -LiteralPath $Lock -Force -ErrorAction SilentlyContinue
    }

    return [bool]$stale
}
