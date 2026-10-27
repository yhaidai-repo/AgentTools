# Register notes are read, changed and written back by more than one process: the backend's chat tools and findings and
# the runner's agents add through this module, and the backend closes records itself. Each writer holds the register's
# exclusive file handle meanwhile (the same persistent `.<note>.lock` the backend's NoteLock takes). Do not delete
# the shared inode: process death releases its handle; an old timestamp does not establish owner death.

function Use-RegisterLock {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][scriptblock]$Action,
        [int]$TimeoutSeconds = 15
    )

    $lock = Get-RegisterLockPath -Path $Path
    Assert-VaultFilePath -Root $Root -Path $Path -ScopeRoot (Split-Path -Parent $Path)
    Assert-VaultFilePath -Root $Root -Path $lock -ScopeRoot (Split-Path -Parent $Path)
    $handle = Enter-RegisterLock -Lock $lock -TimeoutSeconds $TimeoutSeconds
    if (-not $handle) {
        return New-RegisterResult -Errors @('the register is being written by another process: try again in a moment.')
    }

    try {
        return & $Action
    }
    finally {
        $handle.Dispose()
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
    while ($true) {
        $handle = New-RegisterLockFile -Lock $Lock
        if ($handle) { return $handle }

        if ([DateTime]::UtcNow -gt $deadline) {
            return $null
        }

        Start-Sleep -Milliseconds 100
    }
}

function New-RegisterLockFile {
    param([Parameter(Mandatory)][string]$Lock)

    try {
        return [IO.File]::Open($Lock, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    }
    catch [IO.IOException] {
        return $null
    }
}
