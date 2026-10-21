# What Remove-StaleArtefacts.ps1 may remove (dot-sourced): pure selection over folders and worktree states, no removal.
# Each selector answers objects with Path, Bytes and Reason, so the script can print and act on them the same way.

function Get-FolderBytes([string] $Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return 0
    }

    $files = @(Get-ChildItem -LiteralPath $Path -File -Recurse -Force -ErrorAction SilentlyContinue)

    return ($files | Measure-Object -Property Length -Sum).Sum ?? 0
}

# The newest file write under a folder (a folder's own time only says when its entries were listed); the folder's
# time when it holds no file.
function Get-NewestWrite([string] $Path) {
    $files = @(Get-ChildItem -LiteralPath $Path -File -Recurse -Force -ErrorAction SilentlyContinue)

    if ($files.Count -eq 0) {
        return (Get-Item -LiteralPath $Path).LastWriteTimeUtc
    }

    return ($files | Measure-Object -Property LastWriteTimeUtc -Maximum).Maximum
}

function New-Candidate([string] $Path, [long] $Bytes, [string] $Reason, [bool] $Remove = $true) {
    return [pscustomobject]@{ Path = $Path; Bytes = $Bytes; Reason = $Reason; Remove = $Remove }
}

# Service logs of a stopped stack, older than the buffer (they are rewritten on the next start and can hold secrets).
function Get-StaleLogs([string] $StackDir, [bool] $StackRunning, [datetime] $Now, [int] $Days) {
    if ($StackRunning -or -not (Test-Path -LiteralPath $StackDir)) {
        return @()
    }

    $cutoff = $Now.AddDays(-$Days)

    return @(Get-ChildItem -LiteralPath $StackDir -File -Filter "*.log" | Where-Object { $_.LastWriteTimeUtc -lt $cutoff } |
        ForEach-Object { New-Candidate $_.FullName $_.Length "stack stopped, log older than $Days d" })
}

# A recording session's audio once PowerLoom has imported it: the transcript is there and the inbox file
# (<session>.json, written at hand-over) is gone, neither waiting nor in failed/. A session never handed over keeps
# its audio longer. (assumption 2026-10-21: the inbox file is named after the session folder)
function Get-StaleRecordings([string] $RecordingsDir, [string] $InboxDir, [datetime] $Now, [int] $ImportedDays, [int] $UntouchedDays) {
    if (-not (Test-Path -LiteralPath $RecordingsDir)) {
        return @()
    }

    $candidates = foreach ($session in Get-ChildItem -LiteralPath $RecordingsDir -Directory) {
        Get-SessionAudio $session $InboxDir $Now $ImportedDays $UntouchedDays
    }

    return @($candidates)
}

function Get-SessionAudio([System.IO.DirectoryInfo] $Session, [string] $InboxDir, [datetime] $Now, [int] $ImportedDays, [int] $UntouchedDays) {
    $imported = Test-SessionImported $Session $InboxDir
    $days = $(if ($imported) { $ImportedDays } else { $UntouchedDays })
    $reason = $(if ($imported) { "imported, audio older than $days d" } else { "never handed over, older than $days d" })

    if ((Get-NewestWrite $Session.FullName) -ge $Now.AddDays(-$days)) {
        return @()
    }

    return @(Get-ChildItem -LiteralPath $Session.FullName -File -Filter "*.wav" | ForEach-Object { New-Candidate $_.FullName $_.Length $reason })
}

function Test-SessionImported([System.IO.DirectoryInfo] $Session, [string] $InboxDir) {
    $transcript = Join-Path $Session.FullName "transcript.md"
    $waiting = Join-Path $InboxDir "$($Session.Name).json"
    $failed = Join-Path $InboxDir "failed/$($Session.Name).json"

    return (Test-Path -LiteralPath $transcript) -and -not (Test-Path -LiteralPath $waiting) -and -not (Test-Path -LiteralPath $failed)
}

# Claude Code scratch folders nothing wrote to for the buffer.
function Get-StaleScratch([string] $ScratchRoot, [datetime] $Now, [int] $Days) {
    if (-not (Test-Path -LiteralPath $ScratchRoot)) {
        return @()
    }

    $cutoff = $Now.AddDays(-$Days)

    return @(Get-ChildItem -LiteralPath $ScratchRoot -Directory | Where-Object { (Get-NewestWrite $_.FullName) -lt $cutoff } |
        ForEach-Object { New-Candidate $_.FullName (Get-FolderBytes $_.FullName) "nothing written for $Days d" })
}

# The PBI id a branch is named after (feature/33649-…, bugfix/123-…); null for branches without one.
function Get-PbiIdOfBranch([string] $Branch) {
    if ($Branch -match '^[^/]+/(\d+)-') {
        return [int] $Matches[1]
    }

    return $null
}

# When the PBI's backlog note (or its trashed copy) last changed while its status was closed or done; null otherwise.
function Get-PbiClosedDate([string] $BacklogRoot, [int] $PbiId) {
    $notes = @(Get-ChildItem -Path "$BacklogRoot/*/pbi/PBI-$PbiId-*/PBI-$PbiId.md", "$BacklogRoot/*/.trash/pbi/PBI-$PbiId-*/PBI-$PbiId.md" -ErrorAction SilentlyContinue)

    foreach ($note in $notes) {
        $closed = Get-NoteClosedDate $note.FullName

        if ($closed) {
            return $closed
        }
    }

    return $null
}

function Get-NoteClosedDate([string] $NotePath) {
    $frontmatter = Get-Content -LiteralPath $NotePath -TotalCount 40
    $status = ($frontmatter | Where-Object { $_ -match '^status:\s*"?(\w+)"?' } | ForEach-Object { $Matches[1] } | Select-Object -First 1)
    $updated = ($frontmatter | Where-Object { $_ -match '^updated:\s*"?(\d{4}-\d{2}-\d{2})"?' } | ForEach-Object { $Matches[1] } | Select-Object -First 1)

    if ($status -notin @("closed", "done") -or -not $updated) {
        return $null
    }

    return [datetime]::ParseExact($updated, "yyyy-MM-dd", $null)
}

# Which worktrees go: clean, with an upstream and nothing ahead, PBI closed long enough. Every other one is listed
# with why it stays; worktrees under .claude/ (Claude Code's own) never go.
function Select-Worktrees([object[]] $Worktrees, [datetime] $Now, [int] $ClosedDays) {
    return @($Worktrees | ForEach-Object { Select-Worktree $_ $Now $ClosedDays })
}

function Select-Worktree([object] $Worktree, [datetime] $Now, [int] $ClosedDays) {
    $keep = Get-KeepReason $Worktree $Now $ClosedDays

    if ($keep) {
        return New-Candidate $Worktree.Path $Worktree.Bytes $keep $false
    }

    return New-Candidate $Worktree.Path $Worktree.Bytes "clean, pushed, PBI $($Worktree.PbiId) closed $ClosedDays+ d ago"
}

function Get-KeepReason([object] $Worktree, [datetime] $Now, [int] $ClosedDays) {
    if ($Worktree.Path -match '[\\/]\.claude[\\/]') {
        return "Claude Code's own worktree"
    }

    if ($Worktree.Dirty) {
        return "dirty ($($Worktree.DirtyFiles) file(s))"
    }

    if (-not $Worktree.Branch) {
        return "detached HEAD"
    }

    if (-not $Worktree.HasUpstream) {
        return "no remote branch (local only)"
    }

    if ($Worktree.Ahead -gt 0) {
        return "$($Worktree.Ahead) commit(s) not pushed"
    }

    if ($null -eq $Worktree.PbiId) {
        return "no PBI in the branch name"
    }

    if ($null -eq $Worktree.PbiClosedAt) {
        return "PBI $($Worktree.PbiId) not closed"
    }

    if ($Worktree.PbiClosedAt -gt $Now.AddDays(-$ClosedDays)) {
        return "PBI $($Worktree.PbiId) closed less than $ClosedDays d ago"
    }

    return $null
}
