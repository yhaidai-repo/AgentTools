# Hold an exclusive file handle on the shared vault mount, including across container IPC namespaces.
# Keep the lock inode: deleting it would let another writer lock a different file at the same path.
function Use-DraftLock {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Root,
        [string]$ScopeRoot,
        [Parameter(Mandatory)][scriptblock]$Action,
        [int]$TimeoutSeconds = 15
    )
    $lock = Join-Path (Split-Path -Parent $Path) ".$([IO.Path]::GetFileName($Path)).lock"
    Assert-VaultFilePath -Root $Root -Path $Path -ScopeRoot $ScopeRoot
    Assert-VaultFilePath -Root $Root -Path $lock -ScopeRoot $ScopeRoot
    New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force | Out-Null
    $deadline = [datetime]::UtcNow.AddSeconds($TimeoutSeconds)
    $handle = $null
    try {
        while (-not $handle) {
            Assert-VaultFilePath -Root $Root -Path $lock -ScopeRoot $ScopeRoot
            try { $handle = [IO.File]::Open($lock, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
            catch [IO.IOException] {
                if ([datetime]::UtcNow -ge $deadline) { throw 'the draft is being written by another process: try again in a moment.' }
                Start-Sleep -Milliseconds 50
            }
        }
        return & $Action
    }
    finally {
        if ($handle) { $handle.Dispose() }
    }
}
