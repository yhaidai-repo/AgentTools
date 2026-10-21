<#
.SYNOPSIS
    Removes the stale artefacts on this PC that PowerLoom's cleanup job (in Docker) cannot reach: stopped-stack logs,
    imported meeting audio, worktrees of closed PBIs and Claude Code scratch folders. -DryRun lists them with sizes.

.DESCRIPTION
    Selection rules: StaleArtefacts.Selection.ps1 (README "Stale artefacts on this PC"). Worktrees go only when clean,
    pushed with nothing ahead and their PBI closed or done for -WorktreeClosedDays; dirty, local-only and no-PBI
    worktrees are listed, never removed.

.EXAMPLE
    ./Remove-StaleArtefacts.ps1 -DryRun
#>
[CmdletBinding()]
param(
    [switch] $DryRun,
    [int] $LogDays = 7,
    [int] $RecordingDays = 7,
    [int] $UntouchedRecordingDays = 30,
    [int] $WorktreeClosedDays = 14,
    [int] $ScratchDays = 7,
    [string] $ReposRoot = "D:/Projects",
    [string] $BacklogRoot = "D:/Claude/powerloom-backlog",
    [string[]] $Repos = @("PVS", "PVS.Internal", "AgentTools")
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot/DevSecrets.Common.ps1"
. "$PSScriptRoot/LocalStack.Process.ps1"
. "$PSScriptRoot/StaleArtefacts.Selection.ps1"

$now = [datetime]::UtcNow
$recordingsDir = Join-Path $PSScriptRoot "../PowerLoom/tools/audio-capture/home/recordings"
$meetingsInbox = Join-Path $PSScriptRoot "../PowerLoom/import-inbox/meetings"
$scratchRoot = Join-Path $env:LOCALAPPDATA "Temp/claude"

function Test-StackRunning() {
    $state = Read-StackState

    return $null -ne $state -and @($state.services | Where-Object { Test-EntryAlive $_ }).Count -gt 0
}

function Get-WorktreeState([string] $RepoRoot) {
    $lines = @(git -C $RepoRoot worktree list --porcelain)
    $paths = @($lines | Where-Object { $_ -like "worktree *" } | ForEach-Object { $_.Substring(9) })

    return @($paths | Select-Object -Skip 1 | ForEach-Object { Read-Worktree $_ })
}

function Read-Worktree([string] $Path) {
    $branch = (git -C $Path symbolic-ref --quiet --short HEAD 2>$null)
    $dirty = @(git -C $Path status --porcelain)
    $upstream = (git -C $Path rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null)
    $ahead = $(if ($upstream) { [int] (git -C $Path rev-list --count "$upstream..HEAD") } else { 0 })
    $pbiId = $(if ($branch) { Get-PbiIdOfBranch $branch } else { $null })

    return [pscustomobject]@{
        Path = $Path
        Branch = $branch
        Dirty = $dirty.Count -gt 0
        DirtyFiles = $dirty.Count
        HasUpstream = [bool] $upstream
        Ahead = $ahead
        PbiId = $pbiId
        PbiClosedAt = $(if ($null -ne $pbiId) { Get-PbiClosedDate $BacklogRoot $pbiId } else { $null })
        Bytes = Get-FolderBytes $Path
    }
}

function Format-Bytes([long] $Bytes) {
    if ($Bytes -ge 1GB) { return "{0:n1} GB" -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return "{0:n1} MB" -f ($Bytes / 1MB) }

    return "{0:n0} KB" -f ($Bytes / 1KB)
}

# An empty selection arrives as one $null element: only real candidates are printed and acted on.
function Write-Store([string] $Title, [object[]] $Candidates) {
    $listed = @($Candidates | Where-Object { $_ })
    $going = @($listed | Where-Object Remove)
    $bytes = ($going | Measure-Object -Property Bytes -Sum).Sum ?? 0

    Write-Host "`n$Title`: $($going.Count) to remove, $(Format-Bytes $bytes)"
    $listed | ForEach-Object { Write-Host "  $(if ($_.Remove) { '-' } else { 'keep' }) $($_.Path) ($(Format-Bytes $_.Bytes)): $($_.Reason)" }
}

function Remove-Candidates([object[]] $Candidates, [scriptblock] $Remove) {
    if ($DryRun) {
        return
    }

    foreach ($candidate in @($Candidates | Where-Object { $_ -and $_.Remove })) {
        & $Remove $candidate
    }
}

function Remove-PathCandidate([object] $Candidate) {
    Remove-Item -LiteralPath $Candidate.Path -Recurse -Force -Confirm:$false
}

function Remove-WorktreeCandidate([object] $Candidate) {
    $repo = Split-Path -Parent (Split-Path -Parent (git -C $Candidate.Path rev-parse --git-common-dir))

    git -C $repo worktree remove $Candidate.Path

    if ($LASTEXITCODE -ne 0) {
        throw "git worktree remove failed for $($Candidate.Path)"
    }

    git -C $repo worktree prune
}

$logs = Get-StaleLogs $StackDir (Test-StackRunning) $now $LogDays
$recordings = Get-StaleRecordings $recordingsDir $meetingsInbox $now $RecordingDays $UntouchedRecordingDays
$worktrees = Select-Worktrees @($Repos | ForEach-Object { Get-WorktreeState (Join-Path $ReposRoot $_) }) $now $WorktreeClosedDays
$scratch = Get-StaleScratch $scratchRoot $now $ScratchDays

Write-Host "Stale artefacts $(if ($DryRun) { '(dry run: nothing is removed)' } else { '(removing)' })"
Write-Store "Stack logs" $logs
Write-Store "Meeting audio" $recordings
Write-Store "Worktrees" $worktrees
Write-Store "Claude scratch" $scratch

Remove-Candidates $logs ${function:Remove-PathCandidate}
Remove-Candidates $recordings ${function:Remove-PathCandidate}
Remove-Candidates $worktrees ${function:Remove-WorktreeCandidate}
Remove-Candidates $scratch ${function:Remove-PathCandidate}
